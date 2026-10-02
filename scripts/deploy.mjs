// Loads keys only from ignored local configuration; never prints secret material.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createPublicClient,createWalletClient,http,erc20Abi,parseUnits,formatUnits} from 'viem';
import {arcTestnet} from 'viem/chains';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
const usdc='0x3600000000000000000000000000000000000000';
const publicClient=createPublicClient({chain:arcTestnet,transport:http('https://rpc.testnet.arc.network')});
if(await publicClient.getChainId()!==5042002)throw new Error('Testnet chain check failed');
const source=Object.fromEntries(readFileSync('/home/rouma/crux/.env.local','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const funder=privateKeyToAccount(source.BUYER_PRIVATE_KEY);
const funderWallet=createWalletClient({account:funder,chain:arcTestnet,transport:http()});
let local={};try{local=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));}catch{}
const key=local.PANELPAY_EXECUTOR_PRIVATE_KEY||generatePrivateKey();
const executor=privateKeyToAccount(key);
let env={...local,PANELPAY_KEY_SCOPE:'arc-testnet',PANELPAY_EXECUTOR_PRIVATE_KEY:key,PANELPAY_EXECUTOR_ADDRESS:executor.address,OPENAI_API_KEY:source.OPENAI_API_KEY,PANELPAY_AGENT_MODEL:'gpt-4o-mini'};
const save=()=>writeFileSync('.env.local',Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});save();
if(!local.PANELPAY_EXECUTOR_PRIVATE_KEY){const tx=await funderWallet.writeContract({address:usdc,abi:erc20Abi,functionName:'transfer',args:[executor.address,parseUnits('3',6)]});await publicClient.waitForTransactionReceipt({hash:tx});console.log('Isolated testnet executor funded:',executor.address,tx);}
if(env.PANELPAY_CONTRACT_ADDRESS){console.log('Existing deployment:',env.PANELPAY_CONTRACT_ADDRESS);process.exit(0);}
const artifact=JSON.parse(readFileSync('out/PanelPay.sol/PanelPay.json','utf8'));
const wallet=createWalletClient({account:executor,chain:arcTestnet,transport:http()});
const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode.object,args:[usdc,executor.address]});
const receipt=await publicClient.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw new Error('Deployment reverted');
env.PANELPAY_CONTRACT_ADDRESS=receipt.contractAddress;env.PANELPAY_DEPLOYMENT_BLOCK=receipt.blockNumber.toString();save();
const approve=await wallet.writeContract({address:usdc,abi:erc20Abi,functionName:'approve',args:[receipt.contractAddress,parseUnits('2',6)]});await publicClient.waitForTransactionReceipt({hash:approve});
mkdirSync('proof',{recursive:true});writeFileSync('proof/deployment.json',JSON.stringify({chainId:5042002,disclaimer:'test USDC, no cash value',contract:receipt.contractAddress,executor:executor.address,signer:'stated Arc testnet signer',transactionHash:hash,block:receipt.blockNumber.toString(),token:usdc,approval:approve,at:new Date().toISOString()},null,2));
console.log('Rail deployed:',receipt.contractAddress,'transaction:',hash,'balance:',formatUnits(await publicClient.readContract({address:usdc,abi:erc20Abi,functionName:'balanceOf',args:[executor.address]}),6));
