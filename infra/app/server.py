# Dummy app the infra runs so "is it working" is answerable in a browser,
# plus a /summarize route proving the Foundry serverless path end to end.
# No auth, no escrow logic -- that's the real API this replaces once built
# (infra/README.md).
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

AZURE_ENDPOINT = os.environ.get("AZURE_ENDPOINT", "")
AZURE_KEY = os.environ.get("AZURE_KEY", "")
REGION = os.environ.get("AZURE_REGION", "unknown")
PORT = int(os.environ.get("PORT", "8080"))
PLACEHOLDER_MARKER = "REPLACE_WITH_"


def _foundry_configured():
    return (
        AZURE_ENDPOINT
        and AZURE_KEY
        and PLACEHOLDER_MARKER not in AZURE_ENDPOINT
        and PLACEHOLDER_MARKER not in AZURE_KEY
    )


def _summarize(text):
    # Exactly the captain's connection script (Code guides screenshot,
    # 2026-08-13): azure-ai-inference ChatCompletionsClient against the
    # Foundry serverless deployment.
    from azure.ai.inference import ChatCompletionsClient
    from azure.ai.inference.models import SystemMessage, UserMessage
    from azure.core.credentials import AzureKeyCredential

    client = ChatCompletionsClient(
        endpoint=AZURE_ENDPOINT,
        credential=AzureKeyCredential(AZURE_KEY),
    )
    response = client.complete(
        messages=[
            SystemMessage(content="You are a helpful assistant."),
            UserMessage(content=text),
        ],
    )
    return response.choices[0].message.content


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path.startswith("/summarize"):
            if not _foundry_configured():
                self._json(
                    503,
                    {
                        "status": "not_configured",
                        "message": "AZURE_ENDPOINT/AZURE_KEY not set -- paste the Foundry portal values into Key Vault, see infra/README.md",
                    },
                )
                return
            try:
                reply = _summarize("Can you use python for creating a frontend app?")
                self._json(200, {"status": "ok", "reply": reply})
            except Exception as exc:  # demo route -- surface the error, don't hide it
                self._json(502, {"status": "error", "message": str(exc)})
            return

        self._json(
            200,
            {
                "status": "ok",
                "service": "aira-dummy",
                "region": REGION,
                "path": self.path,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
