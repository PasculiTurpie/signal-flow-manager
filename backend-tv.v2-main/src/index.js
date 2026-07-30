require("dotenv").config();

const app = require("./app");
const { connectMongoose } = require("./config/config.mongoose");

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await connectMongoose();

    app.listen(PORT, () => {
      console.log(`🚀 API listening on http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

bootstrap();
