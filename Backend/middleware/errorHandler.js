function notFound(req, res) {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || (['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
  const message = status >= 500 ? 'Internal server error' : err.message;
  if (status >= 500) console.error(err.message);
  res.status(status).json({ success: false, error: { message } });
}

module.exports = { notFound, errorHandler };
