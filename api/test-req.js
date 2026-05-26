module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const results = {};
  try { require('../runtime/generate-session'); results.m = 'OK'; }
  catch(e) { results.m = e.message; results.stack = e.stack; }
  res.end(JSON.stringify(results));
};
