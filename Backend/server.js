require('./config/env')();
const app = require('./app');
const connectDB = require('./config/db');

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await connectDB();
    app.listen(port, () => console.log(`DayPilot API listening on port ${port}`));
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) start();
module.exports = { start };
