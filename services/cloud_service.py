import os
from google.cloud import secretmanager
from google.cloud import storage
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class CloudService:
    """
    Enterprise service for interacting with Google Cloud Platform core services.
    Demonstrates professional cloud-native architecture.
    """
    def __init__(self):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "election-assistant-app-123")
        self.storage_client = None
        self.secret_client = None
        
        try:
            self.secret_client = secretmanager.SecretManagerServiceClient()
        except Exception as e:
            logger.warning(f"Secret Manager client could not be initialized: {e}")

        try:
            self.storage_client = storage.Client()
        except Exception as e:
            logger.warning(f"Cloud Storage client could not be initialized: {e}")

    def get_secret(self, secret_id: str, version_id: str = "latest") -> str:
        """
        Retrieves a secret from Google Cloud Secret Manager with fallback.

        Args:
            secret_id (str): The ID of the secret to retrieve.
            version_id (str): The version of the secret. Defaults to "latest".

        Returns:
            str: The secret value or empty string if not found.
        """
        try:
            if not self.secret_client:
                # Attempt late initialization if failed initially
                self.secret_client = secretmanager.SecretManagerServiceClient()
            
            name = f"projects/{self.project_id}/secrets/{secret_id}/versions/{version_id}"
            response = self.secret_client.access_secret_version(request={"name": name})
            logger.info(f"Secret {secret_id} retrieved successfully from Secret Manager.")
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            fallback = os.getenv(secret_id, "")
            if fallback:
                logger.warning(f"Secret {secret_id} not found in Secret Manager. Falling back to Environment Variable.")
            else:
                logger.error(f"Failed to retrieve secret {secret_id} from both Secret Manager and Environment: {e}")
            return fallback

    def upload_file_to_gcs(self, bucket_name: str, file_content: bytes, destination_blob_name: str) -> str:
        """
        Uploads a file to Google Cloud Storage.

        Args:
            bucket_name (str): The name of the GCS bucket.
            file_content (bytes): The binary content of the file.
            destination_blob_name (str): The path/name for the file in GCS.

        Returns:
            str: The public URL of the uploaded blob.
        """
        if not self.storage_client:
            try:
                self.storage_client = storage.Client()
            except Exception as e:
                logger.error(f"Cloud Storage client initialization failed: {e}")
                return ""
        
        try:
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(destination_blob_name)
            blob.upload_from_string(file_content)
            logger.info(f"File {destination_blob_name} successfully uploaded to bucket {bucket_name}.")
            return blob.public_url
        except Exception as e:
            logger.error(f"GCS Upload failed for {destination_blob_name}: {e}")
            return ""

# Singleton instance
cloud_service = CloudService()
