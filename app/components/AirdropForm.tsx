"use client"

import { InputForm } from "../ui/InputForm"
import { useState, useMemo, useEffect, use } from "react"
import { CgSpinner } from "react-icons/cg"
import { chainsToTSender, tsenderAbi, erc20Abi } from "../constants"
import { useChainId, useConfig, useAccount, useWriteContract, useReadContracts, useWaitForTransactionReceipt } from "wagmi"
import { readContract, waitForTransactionReceipt } from "@wagmi/core"
import { calculateTotal, formatTokenAmount } from "../utils"

export default function AirdropForm() {
    const [tokenAddress, setTokenAddress] = useState("");
    const [recipients, setRecipients] = useState("");
    const [amounts, setAmounts] = useState("");
    const chainId = useChainId()
    const config = useConfig()
    const account = useAccount()
    const total: number = useMemo(() => calculateTotal(amounts), [amounts])
    const { data: tokenData } = useReadContracts({
        contracts: [
            {
                abi: erc20Abi,
                address: tokenAddress as `0x${string}`,
                functionName: "decimals",
            },
            {
                abi: erc20Abi,
                address: tokenAddress as `0x${string}`,
                functionName: "name",
            },
            {
                abi: erc20Abi,
                address: tokenAddress as `0x${string}`,
                functionName: "balanceOf",
                args: [account.address],
            },
        ],
    })

    const [hasEnoughTokens, setHasEnoughTokens] = useState(true)

    const { data: hash, isPending, error, writeContractAsync } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed, isError } = useWaitForTransactionReceipt({
        confirmations: 1,
        hash
    })

    async function getApprovedAmount(tSenderAddress: string | null): Promise<number> {
        if (!tSenderAddress) {
            alert("No address found, please use a supported chain")
            return 0
        }
        // read from the chain to see if we have approved enough tokens
        const response = await readContract(config, {
            abi: erc20Abi,
            address: tokenAddress as `0x${string}`,
            functionName: "allowance",
            args: [account.address, tSenderAddress as `0x${string}`],
        })
        return response as number

    }

    async function handleSubmit() {
        // 1a. If already approved, move to step 2
        // 1b. Approve our tsender contract to send our tokens
        // 2. Call the airdrop function on our tsender contract
        // 3. Wait for transaction to be mined
        const tSenderAddress = chainsToTSender[chainId]["tsender"]
        const approvedAmount = await getApprovedAmount(tSenderAddress)

        if (approvedAmount < total) {
            const approvalHash = await writeContractAsync({
                abi: erc20Abi,
                address: tokenAddress as `0x${string}`,
                functionName: "approve",
                args: [tSenderAddress as `0x${string}`, BigInt(total)],
            })
            const approvalReceipt = await waitForTransactionReceipt(config, {
                hash: approvalHash
            })
            console.log("Approval confirmed:", approvalReceipt)

            await writeContractAsync({
                abi: tsenderAbi,
                address: tSenderAddress as `0x${string}`,
                functionName: "airdropERC20",
                args: [
                    tokenAddress,
                    // Comma or new line separated
                    recipients.split(/[,\n]+/).map(addr => addr.trim()).filter(addr => addr !== ''),
                    amounts.split(/[,\n]+/).map(amt => amt.trim()).filter(amt => amt !== ''),
                    BigInt(total),
                ]
            })
        } else {
            await writeContractAsync({
                abi: tsenderAbi,
                address: tSenderAddress as `0x${string}`,
                functionName: "airdropERC20",
                args: [
                    tokenAddress,
                    // Comma or new line separated
                    recipients.split(/[,\n]+/).map(addr => addr.trim()).filter(addr => addr !== ''),
                    amounts.split(/[,\n]+/).map(amt => amt.trim()).filter(amt => amt !== ''),
                    BigInt(total),
                ]
            })
        }
    }

    function getButtonContent() {
        if (isPending)
            return (
                <div className="flex items-center justify-center gap-2 w-full">
                    <CgSpinner className="animate-spin" size={20} />
                    <span>Confirming in wallet...</span>
                </div>
            )
        if (isConfirming)
            return (
                <div className="flex items-center justify-center gap-2 w-full">
                    <CgSpinner className="animate-spin" size={20} />
                    <span>Waiting for transaction to be included...</span>
                </div>
            )
        if (error || isError) {
            console.log("Error:", error)
            return (
                <div className="flex items-center justify-center gap-2 w-full">
                    <span>Error occurred. See console.</span>
                </div>
            )
        }
        if (isConfirmed) {
            return "Transaction Confirmed!"
        }
        return "Send Tokens"
    }

    useEffect(() => {
        const saveTokenAddress = localStorage.getItem("tokenAddress")
        const saveRecipients = localStorage.getItem("recipients")
        const saveAmounts = localStorage.getItem("amounts")

        if (saveTokenAddress) setTokenAddress(saveTokenAddress)
        if (saveRecipients) setRecipients(saveRecipients)
        if (saveAmounts) setAmounts(saveAmounts)
    }, [])

    useEffect(() => {
        localStorage.setItem("tokenAddress", tokenAddress)
    }, [tokenAddress])

    useEffect(() => {
        localStorage.setItem("recipients", recipients)
    }, [recipients])

    useEffect(() => {
        localStorage.setItem("amounts", amounts)
    }, [amounts])

    useEffect(() => {
        if (tokenAddress && total > 0 && tokenData?.[2]?.result as number !== undefined) {
            const userBalance = tokenData?.[2].result as number
            setHasEnoughTokens(userBalance >= total)
        } else {
            setHasEnoughTokens(true)
        }
    }, [tokenAddress, total, tokenData])


    return (
        <div>
            <InputForm
                label="Token Address"
                placeholder="0X"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
            />
            <InputForm
                label="Recipients"
                placeholder="0X1221, 0X2332, 0X3443"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                large={true}
            />
            <InputForm
                label="Amount"
                placeholder="100, 200, 300,..."
                value={amounts}
                onChange={(e) => setAmounts(e.target.value)}
                large={true}
            />

            <div className="bg-white border border-zinc-300 rounded-lg p-4">
                <h3 className="text-sm font-medium text-zinc-900 mb-3">Transaction Details</h3>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600">Token Name:</span>
                        <span className="font-mono text-zinc-900">
                            {tokenData?.[1]?.result as string}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600">Amount (wei):</span>
                        <span className="font-mono text-zinc-900">{total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600">Amount (tokens):</span>
                        <span className="font-mono text-zinc-900">
                            {formatTokenAmount(total, tokenData?.[0]?.result as number)}
                        </span>
                    </div>
                </div>
            </div>

            <button
                className={`cursor-pointer flex items-center justify-center w-full py-3 rounded-[9px] text-white transition-colors font-semibold relative border
bg-blue-500 hover:bg-blue-600 border-blue-500
                        ${!hasEnoughTokens && tokenAddress ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={handleSubmit}
                disabled={isPending || (!hasEnoughTokens && tokenAddress !== "")}
            >
                {/* Gradient */}
                <div className="absolute w-full inset-0 bg-gradient-to-b from-white/25 via-80% to-transparent mix-blend-overlay z-10 rounded-lg" />
                {/* Inner shadow */}
                <div className="absolute w-full inset-0 mix-blend-overlay z-10 inner-shadow rounded-lg" />
                {/* White inner border */}
                <div className="absolute w-full inset-0 mix-blend-overlay z-10 border-[1.5px] border-white/20 rounded-lg" />
                {isPending || error || isConfirming
                    ? getButtonContent()
                    : !hasEnoughTokens && tokenAddress
                        ? "Insufficient token balance"
                        : "Send Tokens"}
            </button>
        </div>
    );
}