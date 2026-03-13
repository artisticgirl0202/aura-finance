"""
🧪 Tink API 테스트 스크립트

백엔드 서버를 실행한 후 이 스크립트로 Tink 연동을 테스트합니다.
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_banking_health():
    """Banking 서비스 헬스체크"""
    print("\n🏥 Testing Banking Health...")
    response = requests.get(f"{BASE_URL}/api/v1/banking/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.status_code == 200


def test_create_auth_link():
    """인증 링크 생성 테스트"""
    print("\n🔗 Testing Auth Link Creation...")
    
    payload = {
        "user_id": "test_user_123",
        "redirect_uri": "http://localhost:3000/callback"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/banking/auth/link",
        json=payload
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Auth URL created:")
        print(f"   User ID: {data['user_id']}")
        print(f"   Auth URL: {data['auth_url'][:100]}...")
        return data
    else:
        print(f"❌ Error: {response.text}")
        return None


def main():
    print("=" * 60)
    print("🏦 Aura Finance - Tink Integration Test")
    print("=" * 60)
    
    # 1. Health Check
    if not test_banking_health():
        print("\n❌ Banking service is not healthy!")
        return
    
    # 2. Auth Link Creation
    auth_data = test_create_auth_link()
    
    if auth_data:
        print("\n" + "=" * 60)
        print("✅ Backend is ready for Tink integration!")
        print("=" * 60)
        print("\n📝 Next Steps:")
        print("1. Copy the auth_url from above")
        print("2. Open it in a browser")
        print("3. Complete bank authentication")
        print("4. You'll be redirected back with an authorization code")
        print("5. Exchange the code for an access token")
    else:
        print("\n❌ Test failed. Check your Tink credentials in .env")


if __name__ == "__main__":
    main()
