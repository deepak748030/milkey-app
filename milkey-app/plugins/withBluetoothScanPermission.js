const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ensurePermission = (manifest, permissionName, attributes = {}) => {
    const permissions = manifest['uses-permission'] || [];
    let permission = permissions.find(
        (entry) => entry?.$?.['android:name'] === permissionName
    );

    if (!permission) {
        permission = { $: { 'android:name': permissionName } };
        permissions.push(permission);
    }

    permission.$ = {
        ...permission.$,
        ...attributes,
    };

    manifest['uses-permission'] = permissions;
};

const patchThermalPrinterBuildGradle = async (projectRoot) => {
    const targetFile = path.join(
        projectRoot,
        'node_modules',
        'react-native-thermal-printer',
        'android',
        'build.gradle'
    );
    if (!fs.existsSync(targetFile)) return;
    let content = fs.readFileSync(targetFile, 'utf8');
    if (!content.includes('jcenter()')) return;
    const patched = content.replace(/jcenter\(\)/g, 'mavenCentral()');
    if (patched !== content) {
        fs.writeFileSync(targetFile, patched);
        console.log('[withBluetoothScanPermission] Patched react-native-thermal-printer build.gradle: jcenter() -> mavenCentral()');
    }
};

const patchThermalPrinterModule = async (projectRoot) => {
    const targetFile = path.join(
        projectRoot,
        'node_modules',
        'react-native-thermal-printer',
        'android',
        'src',
        'main',
        'java',
        'com',
        'reactnativethermalprinter',
        'ThermalPrinterModule.java'
    );

    if (!fs.existsSync(targetFile)) return;

    const original = fs.readFileSync(targetFile, 'utf8');
    if (original.includes('Milkey insecure RFCOMM fallback')) return;

    let patched = original;

    patched = patched.replace(
        "import android.bluetooth.BluetoothAdapter;\nimport android.bluetooth.BluetoothDevice;\nimport android.text.TextUtils;\n\nimport com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;\n",
        "import android.bluetooth.BluetoothAdapter;\nimport android.bluetooth.BluetoothDevice;\nimport android.bluetooth.BluetoothSocket;\nimport android.os.ParcelUuid;\nimport android.text.TextUtils;\n\nimport com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;\n"
    );

    patched = patched.replace(
        "import java.util.ArrayList;\nimport java.util.Iterator;\nimport java.util.Set;\n",
        "import java.io.IOException;\nimport java.lang.reflect.Method;\nimport java.util.ArrayList;\nimport java.util.Arrays;\nimport java.util.Iterator;\nimport java.util.Set;\nimport java.util.UUID;\n"
    );

    patched = patched.replace(
        "    if (btPrinter == null) {\n      this.jsPromise.reject(\"Connection Error\", \"Bluetooth Device Not Found\");\n    }\n",
        "    if (btPrinter == null) {\n      this.jsPromise.reject(\"Connection Error\", \"Bluetooth Device Not Found\");\n      return;\n    }\n"
    );

    patched = patched.replace(
        "        this.printIt(btPrinter.connect(), payload, autoCut, openCashbox, mmFeedPaper, printerDpi, printerWidthMM, printerNbrCharactersPerLine);\n",
        "        this.printIt(connectBluetoothWithFallback(btPrinter), payload, autoCut, openCashbox, mmFeedPaper, printerDpi, printerWidthMM, printerNbrCharactersPerLine);\n"
    );

    patched = patched.replace(
        "        Set<BluetoothDevice> pairedDevices = BluetoothAdapter.getDefaultAdapter().getBondedDevices();\n        WritableArray rnArray = new WritableNativeArray();\n",
        "        Set<BluetoothDevice> pairedDevices = BluetoothAdapter.getDefaultAdapter().getBondedDevices();\n        btDevicesList.clear();\n        WritableArray rnArray = new WritableNativeArray();\n"
    );

    patched = patched.replace(
        "  private BluetoothConnection getBluetoothConnectionWithMacAddress(String macAddress) {\n    for (BluetoothConnection device : btDevicesList) {\n      if (device.getDevice().getAddress().contentEquals(macAddress))\n        return device;\n    }\n    return null;\n  }\n",
        "  private DeviceConnection connectBluetoothWithFallback(BluetoothConnection btPrinter) throws EscPosConnectionException {\n    try {\n      return btPrinter.connect();\n    } catch (EscPosConnectionException secureError) {\n      BluetoothDevice device = btPrinter.getDevice();\n      if (device == null) {\n        throw secureError;\n      }\n      return new InsecureBluetoothConnection(device).connect();\n    }\n  }\n\n  private BluetoothConnection getBluetoothConnectionWithMacAddress(String macAddress) {\n    BluetoothDevice bondedDevice = getBondedDeviceWithMacAddress(macAddress);\n    if (bondedDevice != null) {\n      return new BluetoothConnection(bondedDevice);\n    }\n\n    for (BluetoothConnection device : btDevicesList) {\n      if (device.getDevice().getAddress().equalsIgnoreCase(macAddress)) {\n        return device;\n      }\n    }\n    return null;\n  }\n\n  private BluetoothDevice getBondedDeviceWithMacAddress(String macAddress) {\n    BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();\n    if (adapter == null || TextUtils.isEmpty(macAddress)) {\n      return null;\n    }\n\n    Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();\n    if (pairedDevices == null || pairedDevices.isEmpty()) {\n      return null;\n    }\n\n    for (BluetoothDevice device : pairedDevices) {\n      if (device != null && macAddress.equalsIgnoreCase(device.getAddress())) {\n        return device;\n      }\n    }\n    return null;\n  }\n\n  // Milkey insecure RFCOMM fallback for SR588-class printers that reject the\n  // stock secure socket path used by the upstream library.\n  private static class InsecureBluetoothConnection extends DeviceConnection {\n    private static final UUID SPP_UUID = UUID.fromString(\"00001101-0000-1000-8000-00805f9b34fb\");\n    private final BluetoothDevice device;\n    private BluetoothSocket socket = null;\n\n    InsecureBluetoothConnection(BluetoothDevice device) {\n      super();\n      this.device = device;\n    }\n\n    @Override\n    public boolean isConnected() {\n      return this.socket != null && this.socket.isConnected() && super.isConnected();\n    }\n\n    @Override\n    public DeviceConnection connect() throws EscPosConnectionException {\n      if (this.isConnected()) {\n        return this;\n      }\n\n      if (this.device == null) {\n        throw new EscPosConnectionException(\"Bluetooth device is not connected.\");\n      }\n\n      BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();\n      UUID uuid = this.getDeviceUUID();\n\n      try {\n        this.socket = this.device.createInsecureRfcommSocketToServiceRecord(uuid);\n        if (bluetoothAdapter != null) {\n          bluetoothAdapter.cancelDiscovery();\n        }\n        this.socket.connect();\n        this.outputStream = this.socket.getOutputStream();\n        this.data = new byte[0];\n      } catch (IOException insecureUuidError) {\n        insecureUuidError.printStackTrace();\n        this.disconnect();\n\n        try {\n          this.socket = this.createChannelOneSocket();\n          if (bluetoothAdapter != null) {\n            bluetoothAdapter.cancelDiscovery();\n          }\n          this.socket.connect();\n          this.outputStream = this.socket.getOutputStream();\n          this.data = new byte[0];\n        } catch (Exception channelOneError) {\n          channelOneError.printStackTrace();\n          this.disconnect();\n          throw new EscPosConnectionException(\"Unable to connect to bluetooth device.\");\n        }\n      }\n\n      return this;\n    }\n\n    private BluetoothSocket createChannelOneSocket() throws Exception {\n      Method createRfcommSocket = this.device.getClass().getMethod(\"createRfcommSocket\", int.class);\n      return (BluetoothSocket) createRfcommSocket.invoke(this.device, 1);\n    }\n\n    private UUID getDeviceUUID() {\n      ParcelUuid[] uuids = this.device.getUuids();\n      if (uuids != null && uuids.length > 0) {\n        if (Arrays.asList(uuids).contains(new ParcelUuid(SPP_UUID))) {\n          return SPP_UUID;\n        }\n        return uuids[0].getUuid();\n      }\n      return SPP_UUID;\n    }\n\n    @Override\n    public DeviceConnection disconnect() {\n      this.data = new byte[0];\n      if (this.outputStream != null) {\n        try {\n          this.outputStream.close();\n        } catch (IOException e) {\n          e.printStackTrace();\n        }\n        this.outputStream = null;\n      }\n      if (this.socket != null) {\n        try {\n          this.socket.close();\n        } catch (IOException e) {\n          e.printStackTrace();\n        }\n        this.socket = null;\n      }\n      return this;\n    }\n  }\n"
    );

    if (patched !== original) {
        fs.writeFileSync(targetFile, patched);
    }
};

module.exports = function withBluetoothScanPermission(config) {
    config = withAndroidManifest(config, (modConfig) => {
        const manifest = modConfig.modResults.manifest;

        // Legacy Bluetooth perms — only needed up to Android 11 (API 30).
        ensurePermission(manifest, 'android.permission.BLUETOOTH', {
            'android:maxSdkVersion': '30',
        });
        ensurePermission(manifest, 'android.permission.BLUETOOTH_ADMIN', {
            'android:maxSdkVersion': '30',
        });

        // Modern Bluetooth perms (Android 12+, API 31+).
        ensurePermission(manifest, 'android.permission.BLUETOOTH_CONNECT');
        // BLUETOOTH_SCAN with neverForLocation tells Android we won't derive
        // user location from BT scan results, so ACCESS_FINE_LOCATION is NOT
        // required at runtime on Android 12+ — the user gets a cleaner flow.
        ensurePermission(manifest, 'android.permission.BLUETOOTH_SCAN', {
            'android:usesPermissionFlags': 'neverForLocation',
        });

        // Location is only needed on Android <= 11 to enumerate BT devices.
        // Cap it at API 30 so Android 12+ users never see a Location prompt.
        ensurePermission(manifest, 'android.permission.ACCESS_FINE_LOCATION', {
            'android:maxSdkVersion': '30',
        });
        ensurePermission(manifest, 'android.permission.ACCESS_COARSE_LOCATION', {
            'android:maxSdkVersion': '30',
        });

        return modConfig;
    });

    return withDangerousMod(config, ['android', async (modConfig) => {
        await patchThermalPrinterBuildGradle(modConfig.modRequest.projectRoot);
        await patchThermalPrinterModule(modConfig.modRequest.projectRoot);
        return modConfig;
    }]);
};