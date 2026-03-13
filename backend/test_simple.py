import os
import sys
from dotenv import load_dotenv

# 유니코드 출력 설정
sys.stdout.reconfigure(encoding='utf-8')

# .env 로드
load_dotenv()

# 환경 변수 확인
print("=" * 60)
print("Tink API Configuration Check")
print("=" * 60)

client_id = os.getenv("TINK_CLIENT_ID")
client_secret = os.getenv("TINK_CLIENT_SECRET")

print(f"TINK_CLIENT_ID: {client_id}")
print(f"TINK_CLIENT_SECRET: {client_secret[:10]}..." if client_secret else "None")

if not client_id or not client_secret:
    print("\nERROR: Tink credentials not found!")
    sys.exit(1)

# TinkService 초기화 테스트
try:
    from services.tink_service import tink_service
    print("\nTinkService initialized successfully!")

    # Client token 테스트
    import asyncio
    async def test_token():
        try:
            token = await tink_service.get_client_access_token()
            print(f"Client access token obtained: {token[:20]}...")
            return True
        except Exception as e:
            print(f"ERROR getting token: {e}")
            import traceback
            traceback.print_exc()
            return False

    success = asyncio.run(test_token())

    if success:
        print("\nAll checks passed! Tink API is working.")
    else:
        print("\nFailed to get access token. Check your credentials.")

except Exception as e:
    print(f"\nERROR initializing TinkService: {e}")
    import traceback
    traceback.print_exc()
