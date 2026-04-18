// Stub for react-native-ping. We only use Bluetooth printing, not network/IP printers,
// so the network ping functionality from react-native-thermal-receipt-printer-image-qr
// is never exercised. This stub prevents Metro from failing to resolve the module.
module.exports = {
  default: {
    start: async () => {
      throw new Error('react-native-ping is not available (network printing disabled).');
    },
  },
  start: async () => {
    throw new Error('react-native-ping is not available (network printing disabled).');
  },
};
