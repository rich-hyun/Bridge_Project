// app.js (덮어쓰기용 전체 파일)
// === 반드시 수정할 부분 ===
const TOKEN_A_ADDRESS = "0x4293609b058387ed14e25ee21eb299432bb0e06c"; // A토큰 주소
const TOKEN_B_ADDRESS = "0x0f1434a8b22cb97e7e2c637015f87cac3e7e0f48"; // B토큰 주소
const SWAP_ADDRESS    = "0x6310858b6e26f4f04a3d52effffa300446ed502c"; // Swap 컨트랙트 주소
const RELAYER_ADDRESS = "";

// ABI (필요한 함수만)
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

// UI 접미사 목록 (index.html에 맞춤)
const SUFFIXES = ["", "-2", "-3"];

// 전역 변수
let provider = null;
let signer = null;
let tokenA = null;
let tokenB = null;
let swap = null;

const TMZ_RPC_URL = "https://jkk.mst2.site";
const JKK_CHAIN_ID = 7707;

// 체인 파라미터 (7707 -> 0x1e1b)
const CHAIN_PARAMS = {
  chainId: "0x1e1b",
  chainName: "JKK-TMZ Network",
  rpcUrls: [TMZ_RPC_URL],
  nativeCurrency: { name: "TMZ", symbol: "TMZ", decimals: 18 },
  blockExplorerUrls: []
};

// ----------------- 헬퍼 -----------------
function el(baseId, suffix = "") {
  return document.getElementById(baseId + suffix);
}

function setText(baseId, suffix, text) {
  const node = el(baseId, suffix);
  if (node) node.innerText = text;
}

function safeParseAmount(str) {
  if (!str && str !== 0) return "0";
  try {
    // 숫자 형식 검증: 빈값, 0 허용
    const n = typeof str === "string" ? str.trim() : String(str);
    if (n === "" || isNaN(Number(n))) return "0";
    return n;
  } catch {
    return "0";
  }
}

// 안전한 balanceOf 호출 (revert 방지)
async function safeBalanceOf(contract, address) {
  try {
    const balance = await contract.balanceOf(address);
    return balance;
  } catch (err) {
    console.warn("balanceOf 실패", err);
    return ethers.BigNumber.from(0);
  }
}

// 모든 접미사의 특정 요소에 텍스트 업데이트
function updateAllNetworkStatus(text) {
  SUFFIXES.forEach(suf => setText("networkStatus", suf, text));
}
function updateAllAccount(text) {
  SUFFIXES.forEach(suf => setText("account", suf, text));
}

// ----------------- 컨트랙트 초기화 및 네트워크 관리 -----------------
function initContracts() {
  if (!signer) return;
  tokenA = new ethers.Contract(TOKEN_A_ADDRESS, TOKEN_ABI, signer);
  tokenB = new ethers.Contract(TOKEN_B_ADDRESS, TOKEN_ABI, signer);
  swap   = new ethers.Contract(SWAP_ADDRESS, SWAP_ABI, signer);
  console.log("Contracts initialized");
}

async function ensureNetwork() {
  if (!window.ethereum) throw new Error("window.ethereum 없음");
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS.chainId }] });
  } catch (err) {
    // 체인 추가 필요 시 처리
    if (err && (err.code === 4902 || err?.data?.originalError?.code === 4902)) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS] });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_PARAMS.chainId }] });
    } else {
      console.warn("네트워크 전환 실패:", err);
      throw err;
    }
  }
}

// ----------------- 연결 / 계정 / 네트워크 정보 표시 -----------------
async function waitForEthereum(timeoutMs = 3000) {
  if (window.ethereum) return window.ethereum;
  return new Promise((resolve) => {
    function handler() { resolve(window.ethereum); }
    window.addEventListener('ethereum#initialized', handler, { once: true });
    setTimeout(() => resolve(window.ethereum), timeoutMs);
  });
}

async function connect() {
  const eth = await waitForEthereum();
  if (!eth) {
    alert("MetaMask를 감지하지 못했음. 파일로 열었다면 '파일 URL 접근 허용'을 켜거나 로컬서버로 열어주세요.");
    return;
  }

  provider = new ethers.providers.Web3Provider(eth);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  setText("status", "", "메타마스크 연결 완료 ✅");
  initContracts();

  try {
    await ensureNetwork();
  } catch (e) {
    setText("status", "", "네트워크 전환 실패 ❌");
    console.error(e);
    return;
  }

  await displayNetworkInfo();
  await checkAccount();
  // 계정/체인 변경 이벤트 바인딩
  if (eth && typeof eth.on === "function") {
    eth.on("accountsChanged", async () => {
      await checkAccount();
      await checkBalances(); // 전체 갱신
    });
    eth.on("chainChanged", async () => {
      await displayNetworkInfo();
      initContracts();
      await checkBalances();
    });
  }
}

// chain 정보 표시: 모든 카드에 뿌려줌
async function displayNetworkInfo() {
  if (!provider) {
    updateAllNetworkStatus("네트워크 정보 없음");
    return;
  }
  try {
    const net = await provider.getNetwork();
    const chainId = net.chainId;
    let networkName;
    switch (chainId.toString()) {
      case "1":
        networkName = "Ethereum Mainnet";
        break;
      case "7707":
        networkName = "JKK-TMZ Network";
        break;
      default:
        networkName = `알 수 없는 네트워크 (ID: ${chainId})`;
        break;
    }
    updateAllNetworkStatus(`현재 네트워크: ${networkName}`);
  } catch (err) {
    console.error("displayNetworkInfo 실패", err);
    updateAllNetworkStatus("네트워크 정보 가져오기 실패");
  }
}

async function checkAccount() {
  if (!signer) return;
  try {
    const addr = await signer.getAddress();
    updateAllAccount(`현재 계정: ${addr}`);
  } catch (err) {
    console.warn("checkAccount 실패", err);
  }
}

// ----------------- 버튼 동작 (접미사별) -----------------
async function approveA(suffix = "") {
  if (!tokenA) { setText("status", suffix, "컨트랙트 미초기화"); return; }
  const raw = el("amountInput", suffix)?.value;
  const amountStr = safeParseAmount(raw);
  try {
    const tx = await tokenA.approve(SWAP_ADDRESS, ethers.utils.parseEther(amountStr));
    setText("status", suffix, "TMZ 승인 트랜잭션 전송...");
    await tx.wait();
    setText("status", suffix, "TMZ 승인 완료 ✅");
  } catch (err) {
    console.error("approveA 실패", err);
    setText("status", suffix, "TMZ 승인 실패 ❌");
  }
}

async function approveB(suffix = "") {
  if (!tokenB) { setText("status", suffix, "컨트랙트 미초기화"); return; }
  const raw = el("amountInput", suffix)?.value;
  const amountStr = safeParseAmount(raw);
  try {
    const tx = await tokenB.approve(SWAP_ADDRESS, ethers.utils.parseEther(amountStr));
    setText("status", suffix, "TMZ2 승인 트랜잭션 전송...");
    await tx.wait();
    setText("status", suffix, "TMZ2 승인 완료 ✅");
  } catch (err) {
    console.error("approveB 실패", err);
    setText("status", suffix, "TMZ2 승인 실패 ❌");
  }
}

async function swapAtoB(suffix = "") {
  if (!swap) { setText("status", suffix, "스왑 컨트랙트 미초기화"); return; }
  const raw = el("amountInput", suffix)?.value;
  const amountStr = safeParseAmount(raw);
  try {
    const tx = await swap.swapTMZtoTMZ2(ethers.utils.parseEther(amountStr));
    setText("status", suffix, "스왑 전송 중...");
    await tx.wait();
    setText("status", suffix, "TMZ → TMZ2 스왑 성공 🎉");
    await checkBalances(suffix);
  } catch (err) {
    console.error("swapAtoB 실패", err);
    setText("status", suffix, "TMZ → TMZ2 스왑 실패 ❌");
  }
}

async function swapBtoA(suffix = "") {
  if (!swap) { setText("status", suffix, "스왑 컨트랙트 미초기화"); return; }
  const raw = el("amountInput", suffix)?.value;
  const amountStr = safeParseAmount(raw);
  try {
    const tx = await swap.swapTMZ2toTMZ(ethers.utils.parseEther(amountStr));
    setText("status", suffix, "스왑 전송 중...");
    await tx.wait();
    setText("status", suffix, "TMZ2 → TMZ 스왑 성공 🎉");
    await checkBalances(suffix);
  } catch (err) {
    console.error("swapBtoA 실패", err);
    setText("status", suffix, "TMZ2 → TMZ 스왑 실패 ❌");
  }
}

// 접미사별 잔액 조회 (suffix가 없으면 전부 조회)
async function checkBalances(suffix = null) {
  if (!tokenA || !tokenB || !signer) return;
  const runFor = suffix === null ? SUFFIXES : [suffix];

  for (const suf of runFor) {
    try {
      const address = await signer.getAddress();
      // balanceOf이 실패하는 경우 대비해 safe 호출
      const balA = await safeBalanceOf(tokenA, address);
      const balB = await safeBalanceOf(tokenB, address);

      setText("balanceTMZ", suf, `TMZ 잔액: ${ethers.utils.formatEther(balA)}`);
      setText("balanceTMZ2", suf, `TMZ2 잔액: ${ethers.utils.formatEther(balB)}`);
      setText("status", suf, `컨트랙트 잔고 조회 완료`);
    } catch (err) {
      console.error("checkBalances 실패", err);
      setText("status", suf, "잔고 조회 실패 ❌");
    }
  }
}

// ----------------- UI 바인딩 -----------------
function bindAllUi() {
  SUFFIXES.forEach(suf => {
    const cb = el("connectButton", suf);
    if (cb) cb.onclick = connect; // 모든 connect 버튼은 전역 connect 호출

    const aA = el("approveAButton", suf);
    if (aA) aA.onclick = () => approveA(suf);

    const aB = el("approveBButton", suf);
    if (aB) aB.onclick = () => approveB(suf);

    const sA = el("swapAtoBButton", suf);
    if (sA) sA.onclick = () => swapAtoB(suf);

    const sB = el("swapBtoAButton", suf);
    if (sB) sB.onclick = () => swapBtoA(suf);

    const bb = el("balanceButton", suf);
    if (bb) bb.onclick = () => checkBalances(suf);
  });
}

// ----------------- 초기화 -----------------
(function main() {
  bindAllUi();
  // 페이지 로드 시 이미 연결되어 있으면 상태 표시
  if (window.ethereum && window.ethereum.selectedAddress) {
    // 지연하여 provider 구성
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    initContracts();
    displayNetworkInfo();
    checkAccount();
    checkBalances();
  }
})();

// [ADD] JKK-Net RPC URL (relayer.js와 동일)
const JKK_RPC_URL_FRONT = "http://203.252.147.199";

// [ADD] JKK-Net chain params (0x1e1a == 7706)
const CHAIN_PARAMS_JKK = {
  chainId: "0x1e1a",
  chainName: "JKK-Net",
  rpcUrls: [JKK_RPC_URL_FRONT],
  nativeCurrency: { name: "JKK", symbol: "JKK", decimals: 18 },
  blockExplorerUrls: []
};

// [ADD] 모든 카드의 status 텍스트 갱신
function updateAllStatus(text) {
  SUFFIXES.forEach(suf => setText("status", suf, text));
}


// [ADD] 공통 네트워크 전환 함수
async function switchToChain(params) {
  if (!window.ethereum) {
    alert("MetaMask가 필요합니다.");
    return;
  }
  try {
    updateAllStatus(`${params.chainName}로 전환 요청 중... (MetaMask 확인)`);
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: params.chainId }]
    });
    updateAllStatus(`${params.chainName} 전환 성공 ✅`);
    // 전환 후 체인정보/잔액 UI 새로고침
    await displayNetworkInfo();
    initContracts();
    await checkBalances();
  } catch (err) {
    // 4902: 지갑에 해당 체인이 없음 -> 추가 후 전환
    if (err && (err.code === 4902 || err?.data?.originalError?.code === 4902)) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [params] });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: params.chainId }] });
      updateAllStatus(`${params.chainName} 전환 성공 ✅`);
      await displayNetworkInfo();
      initContracts();
      await checkBalances();
    } else if (err && err.code === 4001) {
      updateAllStatus("사용자가 네트워크 전환을 취소했습니다 ❌");
    } else {
      console.error("switchToChain 실패", err);
      updateAllStatus("네트워크 전환 실패 ❌");
    }
  }
}

// [ADD] 버튼에서 호출할 구체 함수
function switchToTMZ() { return switchToChain(CHAIN_PARAMS); }       // TMZ (0x1e1b)
function switchToJKK() { return switchToChain(CHAIN_PARAMS_JKK); }    // JKK (0x1e1a)

function bindAllUi() {
  SUFFIXES.forEach(suf => {
    const cb = el("connectButton", suf);
    if (cb) cb.onclick = connect;

    // ... (기존 approve/swap/balance 바인딩)

    // [ADD] 네트워크 전환 버튼 바인딩
    const goTMZ = el("switchToTMZButton", suf);
    if (goTMZ) goTMZ.onclick = () => switchToTMZ();

    const goJKK = el("switchToJKKButton", suf);
    if (goJKK) goJKK.onclick = () => switchToJKK();
  });
}
