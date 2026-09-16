export function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  const databaseError = isDatabaseConnectionError(error);
  const status = databaseError ? 503 : error.status || 500;
  const payload = {
    success: false,
    message: databaseError
      ? "PostgreSQL connection failed. Set DB_PASSWORD in server/.env, then run npm run db:setup --prefix server and restart the backend."
      : status === 500 ? "Unexpected server error" : error.message
  };
  if (process.env.NODE_ENV !== "production") payload.error = error.message;
  console.error(error);
  res.status(status).json(payload);
}

function isDatabaseConnectionError(error) {
  const message = String(error?.message || "");
  return ["SASL", "password authentication failed", "ECONNREFUSED", "database", "relation"].some(part => message.includes(part));
}
