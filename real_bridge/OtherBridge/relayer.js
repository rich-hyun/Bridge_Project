// relayer.js

// ethers.js 라이브러리를 가져옵니다.
import "dotenv/config";
import { ethers } from "ethers";

// 1. Relayer 지갑의 개인 키 (Private Key)
//    이 키는 절대로 외부에 노출되면 안 됩니다. 실제 운영 시에는 환경 변수 등을 사용하세요.

// 1. Relayer 지갑의 개인 키 (Private Key)
//    GitHub Actions Secrets 또는 .env 파일을 통해 환경 변수로 주입됩니다.
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// 2. 각 네트워크의 RPC URL
const JKK_RPC_URL = process.env.JKK_RPC_URL || "http://203.252.147.199";
const TMZ_RPC_URL = process.env.TMZ_RPC_URL || "https://jkk.mst2.site";

// --- 컨트랙트 정보 (웹페이지와 동일) ---
const JKK_BRIDGE_ADDRESS = "0xa0ec08442e0783debb54e97b65efc884e67b0fe3";
const TMZ_BRIDGE_ADDRESS = "0xa6ed5c561fa7e4bab95fb4512cf69432037add6f";

const BRIDGE_ABI = [
    "event TokensLocked(address indexed user, uint256 amount, uint256 destinationChainId)",
    "event TokensBurned(address indexed user, uint256 amount, uint256 destinationChainId)",
    "function release(address user, uint256 amount) external",
    "function unlockAndMint(address user, uint256 amount) external",
];

// --- Relayer 로직 ---

async function main() {
    console.log("Starting Relayer...");

    // 1. 각 네트워크에 대한 Provider 설정
    const jkkProvider = new ethers.providers.JsonRpcProvider(JKK_RPC_URL);
    const tmzProvider = new ethers.providers.JsonRpcProvider(TMZ_RPC_URL);

    // 2. Relayer 지갑 설정
    if (!RELAYER_PRIVATE_KEY || RELAYER_PRIVATE_KEY === "YOUR_RELAYER_PRIVATE_KEY") {
        console.error("오류: RELAYER_PRIVATE_KEY를 설정해야 합니다.");
        return;
    }
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY);

    // 3. 각 네트워크와 Relayer 지갑 연결 (Signer 생성)
    const jkkSigner = relayerWallet.connect(jkkProvider);
    const tmzSigner = relayerWallet.connect(tmzProvider);

    // 4. 각 네트워크의 브릿지 컨트랙트 인스턴스 생성
    const jkkBridge = new ethers.Contract(JKK_BRIDGE_ADDRESS, BRIDGE_ABI, jkkSigner);
    const tmzBridge = new ethers.Contract(TMZ_BRIDGE_ADDRESS, BRIDGE_ABI, tmzSigner);

    console.log(`Watching for events on both networks...`);
    console.log(`JKK Bridge: ${JKK_BRIDGE_ADDRESS}`);
    console.log(`TMZ Bridge: ${TMZ_BRIDGE_ADDRESS}`);

    // 5. JKK-Net의 'TokensLocked' 이벤트 감지 리스너 설정
    jkkBridge.on("TokensLocked", async (user, amount, destChainId) => {
        console.log("\n--- Detected TokensLocked on JKK-Net! ---");
        console.log(`  User: ${user}`);
        console.log(`  Amount: ${ethers.utils.formatEther(amount)}`);
        console.log(`  Destination Chain ID: ${destChainId}`);

        try {
            console.log("  -> Calling unlockAndMint on TMZ-Bridge...");
            // TMZ 브릿지의 unlockAndMint 함수 호출
            const tx = await tmzBridge.unlockAndMint(user, amount);
            await tx.wait();
            console.log(`  ✅ Success! Transaction hash on TMZ-Net: ${tx.hash}`);
        } catch (e) {
            console.error("  ❌ Failed to process unlockAndMint:", e.message);
        }
    });

    // 6. JKK-TMZ의 'TokensBurned' 이벤트 감지 리스너 설정
    tmzBridge.on("TokensBurned", async (user, amount, destChainId) => {
        console.log("\n--- Detected TokensBurned on JKK-TMZ! ---");
        console.log(`  User: ${user}`);
        console.log(`  Amount: ${ethers.utils.formatEther(amount)}`);
        console.log(`  Destination Chain ID: ${destChainId}`);
        
        try {
            console.log("  -> Calling release on JKK-Bridge...");
            // JKK 브릿지의 release 함수 호출
            const tx = await jkkBridge.release(user, amount);
            await tx.wait();
            console.log(`  ✅ Success! Transaction hash on JKK-Net: ${tx.hash}`);
        } catch (e) {
            console.error("  ❌ Failed to process release:", e.message);
        }
    });
}

main().catch((error) => {
    console.error("Relayer script failed:", error);
    process.exit(1);
});

