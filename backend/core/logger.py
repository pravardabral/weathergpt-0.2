import logging
from logging.handlers import TimedRotatingFileHandler
import os

os.makedirs("logs", exist_ok=True)

logger = logging.getLogger("WeatherGPT")
logger.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s')

# Console Output
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# File Output (Rotates daily, keeps 7 days)
file_handler = TimedRotatingFileHandler("logs/backend.log", when="midnight", interval=1, backupCount=7)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)