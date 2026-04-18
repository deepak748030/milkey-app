// Stub for react-native-ping. The thermal printer libraries import it for
// network/IP printing (printNet / printTcp), which we don't use — Bluetooth only.
// This stub prevents Metro from failing to resolve the optional native module.
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
