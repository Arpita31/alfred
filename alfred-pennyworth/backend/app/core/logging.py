"""
Logging configuration for the application.
"""
import logging
import sys
from pythonjsonlogger import jsonlogger
from pathlib import Path
from app.core.config import settings

Path("logs").mkdir(exist_ok=True)


def setup_logging():
    json_formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(name)s %(levelname)s %(message)s'
    )
    
    standard_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(standard_formatter)
    console_handler.setLevel(logging.INFO)
    
    file_handler = logging.FileHandler('logs/alfred.log')
    file_handler.setFormatter(json_formatter)
    file_handler.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    error_handler = logging.FileHandler('logs/error.log')
    error_handler.setFormatter(json_formatter)
    error_handler.setLevel(logging.ERROR)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(error_handler)
    
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    
    return root_logger


logger = setup_logging()

################################################################################
