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

        ensurePermission(manifest, 'android.permission.BLUETOOTH', {
            'android:maxSdkVersion': '30',
        });
        ensurePermission(manifest, 'android.permission.BLUETOOTH_ADMIN', {
            'android:maxSdkVersion': '30',
        });
        ensurePermission(manifest, 'android.permission.BLUETOOTH_CONNECT');
        ensurePermission(manifest, 'android.permission.BLUETOOTH_SCAN', {
            'android:usesPermissionFlags': 'neverForLocation',
        });
        ensurePermission(manifest, 'android.permission.ACCESS_FINE_LOCATION');

        return modConfig;
    });
};