// === 반드시 수정할 부분 ===
const TOKEN_A_ADDRESS = "0x4293609b058387ed14e25ee21eb299432bb0e06c"; // A토큰 주소
const TOKEN_B_ADDRESS = "0x0f1434a8b22cb97e7e2c637015f87cac3e7e0f48"; // B토큰 주소
const SWAP_ADDRESS    = "0x6310858b6e26f4f04a3d52effffa300446ed502c"; // Swap 컨트랙트 주소
const RELAYER_ADDRESS = ""


// Remix에서 export한 ABI 붙여넣기 (간단히 필요한 함수만)
const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

const SWAP_ABI = [
  "function swapTMZtoTMZ2(uint256 amount) external",
  "function swapTMZ2toTMZ(uint256 amount) external"
];


// === 전역 변수 ===
let provider, signer, tokenA, tokenB, swap;
const TMZ_RPC_URL = "https://jkk.mst2.site";
const JKK_CHAIN_ID = 7707;

// 네트워크 정보 표시할 div 추가 (HTML에 표시할 위치)
async function connect() {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []); // MetaMask 계정 요청
    signer = provider.getSigner();
    document.getElementById("status").innerText = "메타마스크 연결 완료 ✅";

    // 네트워크 정보 표시
    displayNetworkInfo();
  } else {
    alert("MetaMask를 설치해주세요!");
  }
}

// 네트워크 정보 확인
async function displayNetworkInfo() {
  try {
    const networkId = await provider.send("net_version", []); // net_version 메서드로 네트워크 ID 가져오기
    console.log("현재 네트워크 ID (net_version):", networkId);  // 네트워크 ID 출력

    let networkName;

    // 네트워크 ID를 문자열로 처리하여 비교
    switch (networkId.toString()) {
      case "1":
        networkName = "Ethereum Mainnet";
        break;
      case "7707":
        networkName = "JKK-TMZ Network";  // 7707 네트워크 설정
        break;
      default:
        networkName = `알 수 없는 네트워크 (ID: ${networkId})`; // 네트워크 ID 출력
        break;
    }

    console.log("현재 연결된 네트워크:", networkName); // 연결된 네트워크 이름 출력
    document.getElementById("networkStatus").innerText = `현재 네트워크: ${networkName}`;
  } catch (error) {
    console.error("네트워크 정보 가져오기 실패", error);
    document.getElementById("networkStatus").innerText = "네트워크 정보 불러오기 실패 ❌";
  }
}




// A 승인
async function approveA() {
  try {
    const amount = document.getElementById("amountInput").value;
    const tx = await tokenA.approve(SWAP_ADDRESS, ethers.utils.parseEther(amount));
    await tx.wait();
    document.getElementById("status").innerText = "TMZ 승인 완료 ✅";
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "TMZ 승인 실패 ❌";
  }
}

// B 승인
async function approveB() {
  try {
    const amount = document.getElementById("amountInput").value;
    const tx = await tokenB.approve(SWAP_ADDRESS, ethers.utils.parseEther(amount));
    await tx.wait();
    document.getElementById("status").innerText = "TMZ2 승인 완료 ✅";
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "TMZ2 승인 실패 ❌";
  }
}

// A → B 교환
async function swapAtoB() {
  try {
    const amount = document.getElementById("amountInput").value;
    const tx = await swap.swapTMZtoTMZ2(ethers.utils.parseEther(amount));
    await tx.wait();
    document.getElementById("status").innerText = "TMZ → TMZ2 스왑 성공 🎉";
    
    // 교환 후 컨트랙트 잔고를 다시 조회
    checkBalances();
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "TMZ → TMZ2 스왑 실패 ❌";
  }
}

// B → A 교환
async function swapBtoA() {
  try {
    const amount = document.getElementById("amountInput").value;
    const tx = await swap.swapTMZ2toTMZ(ethers.utils.parseEther(amount));
    await tx.wait();
    document.getElementById("status").innerText = "TMZ2 → TMZ 스왑 성공 🎉";
    
    // 교환 후 컨트랙트 잔고를 다시 조회
    checkBalances();
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "TMZ2 → TMZ 스왑 실패 ❌";
  }
}

// balanceOf 호출을 안전하게 하는 함수
async function safeBalanceOf(token, address) {
  try {
    console.log(`balanceOf 호출 중... 주소: ${address}`);  // 호출 직전
    const balance = await token.balanceOf(address);
    console.log(`balanceOf 호출 후... 잔액: ${ethers.utils.formatEther(balance)}`);  // 호출 후
    return balance;
  } catch (err) {
    console.warn("balanceOf 호출 실패", err);
    return ethers.BigNumber.from(0);
  }
}


// 잔액 조회 및 화면에 표시
async function checkBalances() {
  if (!tokenA || !tokenB || !swap) return;

  try {
    const swapAddress = await signer.getAddress();  // 현재 연결된 계정 주소
    console.log("현재 계정 주소:", swapAddress);  // 계정 주소 출력

    const balanceA = await safeBalanceOf(tokenA, swapAddress);
    const balanceB = await safeBalanceOf(tokenB, swapAddress);
    
    // 잔액을 화면에 표시
    document.getElementById("status").innerText =
      `컨트랙트 잔고 👉 TMZ: ${ethers.utils.formatEther(balanceA)} , TMZ2: ${ethers.utils.formatEther(balanceB)}`;

    // HTML에 토큰 잔액 표시
    document.getElementById("balanceTMZ").innerText = `TMZ 잔액: ${ethers.utils.formatEther(balanceA)}`;
    document.getElementById("balanceTMZ2").innerText = `TMZ2 잔액: ${ethers.utils.formatEther(balanceB)}`;

    console.log("TMZ 잔액:", ethers.utils.formatEther(balanceA));  // TMZ 잔액 출력
    console.log("TMZ2 잔액:", ethers.utils.formatEther(balanceB));  // TMZ2 잔액 출력

  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "잔고 조회 실패 ❌";
  }
}

async function checkAccount() {
  if (signer) {
    const account = await signer.getAddress();
    document.getElementById("account").innerText = `현재 계정: ${account}`;
  }
}

// 버튼 이벤트 연결
document.getElementById("connectButton").onclick = connect;

// Safer connect wrapper: wait for MetaMask injection and handle file:// cases
async function waitForEthereum(timeoutMs = 3000) {
  if (window.ethereum) return window.ethereum;
  return await new Promise((resolve) => {
    function handler() { resolve(window.ethereum); }
    window.addEventListener('ethereum#initialized', handler, { once: true });
    setTimeout(() => resolve(window.ethereum), timeoutMs);
  });
}

async function connect2() {
  const eth = await waitForEthereum();
  if (!eth) {
    alert("MetaMask가 감지되지 않았어요. 파일로 여셨다면 확장 프로그램 설정에서 '파일 URL에 대한 액세스 허용'을 켜거나, 로컬 서버(http://localhost)로 열어주세요.");
    return;
  }

  provider = new ethers.providers.Web3Provider(eth);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  document.getElementById("status").innerText = "메타마스크 연결 완료";

  try {
    await ensureNetwork();
  } catch (e) {
    document.getElementById("status").innerText = "네트워크 전환 실패";
    console.error(e);
    return;
  }

  initContracts();
  await displayNetworkInfo();
  await checkAccount();

  if (eth && typeof eth.on === "function") {
    eth.on("accountsChanged", () => {
      checkAccount();
      checkBalances();
    });
    eth.on("chainChanged", () => {
      displayNetworkInfo();
      initContracts();
      checkBalances();
    });
  }
}

// Bind button to safer connect
document.getElementById("connectButton").onclick = connect2;
document.getElementById("approveAButton").onclick = approveA;
document.getElementById("approveBButton").onclick = approveB;
document.getElementById("swapAtoBButton").onclick = swapAtoB;
document.getElementById("swapBtoAButton").onclick = swapBtoA;
document.getElementById("balanceButton").onclick = checkBalances;

// === Enhance: network switch + contract init ===
const CHAIN_PARAMS = {
  chainId: "0x1E1B", // 7707
  chainName: "JKK-TMZ Network",
  rpcUrls: [TMZ_RPC_URL],
  nativeCurrency: { name: "TMZ", symbol: "TMZ", decimals: 18 },
  blockExplorerUrls: []
};

function initContracts() {
  tokenA = new ethers.Contract(TOKEN_A_ADDRESS, TOKEN_ABI, signer);
  tokenB = new ethers.Contract(TOKEN_B_ADDRESS, TOKEN_ABI, signer);
  swap   = new ethers.Contract(SWAP_ADDRESS,  SWAP_ABI,  signer);
}

async function ensureNetwork() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS.chainId }] });
  } catch (err) {
    if (err && (err.code === 4902 || err?.data?.originalError?.code === 4902)) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS] });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS.chainId }] });
    } else {
      console.warn("네트워크 전환 실패:", err);
      throw err;
    }
  }
}

// Override: displayNetworkInfo to use chainId
async function displayNetworkInfo() {
  try {
    const network = await provider.getNetwork();
    const networkId = network.chainId;
    console.log("현재 체인 ID:", networkId);

    let networkName;
    switch (networkId.toString()) {
      case "1":
        networkName = "Ethereum Mainnet";
        break;
      case "7707":
        networkName = "JKK-TMZ Network";
        break;
      default:
        networkName = `알 수 없는 네트워크 (ID: ${networkId})`;
        break;
    }

    document.getElementById("networkStatus").innerText = `현재 네트워크: ${networkName}`;
  } catch (error) {
    console.error("네트워크 정보 조회 실패", error);
    document.getElementById("networkStatus").innerText = "네트워크 정보를 가져오지 못했어요";
  }
}

// Override: connect to ensure network and init contracts
async function connect() {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    document.getElementById("status").innerText = "메타마스크 연결 완료";

    try {
      await ensureNetwork();
    } catch (e) {
      document.getElementById("status").innerText = "네트워크 전환 실패";
      console.error(e);
      return;
    }

    initContracts();
    await displayNetworkInfo();
    await checkAccount();

    if (window.ethereum && typeof window.ethereum.on === "function") {
      window.ethereum.on("accountsChanged", () => {
        checkAccount();
        checkBalances();
      });
      window.ethereum.on("chainChanged", () => {
        displayNetworkInfo();
        initContracts();
        checkBalances();
      });
    }
  } else {
    alert("MetaMask를 설치해주세요!");
  }
}

// Re-bind events to latest functions
document.getElementById("connectButton").onclick = connect;
