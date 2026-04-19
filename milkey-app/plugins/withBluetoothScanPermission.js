const { withAndroidManifest } = require('expo/config-plugins');

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

module.exports = function withBluetoothScanPermission(config) {
    return withAndroidManifest(config, (modConfig) => {
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
};