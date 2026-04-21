import logging
import json
import sys
from typing import Any, Dict

class GCPJsonFormatter(logging.Formatter):
    """
    A custom JSON formatter for Google Cloud Logging.
    Outputs structured JSON payloads that Cloud Run natively understands.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "severity": record.levelname,
            "message": super().format(record),
            "logger": record.name,
            "line": record.lineno,
            "func": record.funcName
        }
        
        # Add any extra arguments passed to the logger
        if hasattr(record, "extra_args"):
            log_entry.update(record.extra_args)
            
        return json.dumps(log_entry)

def setup_cloud_logger(name: str) -> logging.Logger:
    """
    Initializes a structured JSON logger for GCP.
    
    Args:
        name (str): The name of the logger (usually __name__).
        
    Returns:
        logging.Logger: The configured logger instance.
    """
    logger: logging.Logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Prevent duplicate logs if already configured
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = GCPJsonFormatter()
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger
