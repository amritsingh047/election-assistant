
import sys
import os

# Add current directory to path to simulate package structure
sys.path.append('.')

try:
    from backend.routes import assistant_router, analytics_router, auth_router
    print("Imports successful from backend.routes")
    import main
    print("Main app module imported successfully")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
