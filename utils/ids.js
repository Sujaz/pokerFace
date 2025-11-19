function generateId(prefix = 'session') {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

module.exports = { generateId };
