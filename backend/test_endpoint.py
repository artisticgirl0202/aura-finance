"""
직접 엔드포인트 테스트
"""
import sys
import requests
import json

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("Testing /api/v1/banking/auth/link endpoint")
print("=" * 60)

url = "http://localhost:8000/api/v1/banking/auth/link"
payload = {
    "user_id": "test_user_123",
    "redirect_uri": "http://localhost:3000/callback"
}

try:
    print(f"\nSending POST request to: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")

    response = requests.post(url, json=payload, timeout=10)

    print(f"\nStatus Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"\nResponse Body:")

    if response.status_code == 200:
        print(json.dumps(response.json(), indent=2))
    else:
        print(response.text)

except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
