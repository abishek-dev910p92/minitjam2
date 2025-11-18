module.exports = {
  Platform: { OS: 'web', select: (x) => x?.web || x?.default },
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} }),
  },
};