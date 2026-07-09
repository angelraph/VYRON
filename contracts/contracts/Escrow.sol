// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VYRON Escrow
/// @notice Locks native token funds per task and either releases them to
/// the assigned agent on verified delivery or refunds the payer if the
/// task is reassigned/cancelled. VYRON's backend (ORCHESTRATOR_ROLE) is
/// the only caller — end users never call this contract directly, since
/// VYRON itself decides when a task is delivered, verified, and settled.
contract Escrow is AccessControl, ReentrancyGuard {
    bytes32 public constant ORCHESTRATOR_ROLE = keccak256("ORCHESTRATOR_ROLE");

    enum Status {
        None,
        Locked,
        Released,
        Refunded
    }

    struct EscrowEntry {
        address payer;
        address agent;
        uint256 amount;
        Status status;
    }

    uint256 private _nextEscrowId = 1;
    mapping(uint256 => EscrowEntry) private _escrows;

    event EscrowLocked(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed agent,
        uint256 amount
    );
    event EscrowReleased(uint256 indexed escrowId, address indexed agent, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed payer, uint256 amount);

    error EscrowNotLocked(uint256 escrowId);
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORCHESTRATOR_ROLE, admin);
    }

    /// @notice Locks `msg.value` for `agent`. The orchestrator wallet
    /// supplies the funds directly (it holds the treasury on behalf of
    /// users in this MVP), so `payer` is recorded as `msg.sender`.
    function lockFunds(address agent) external payable onlyRole(ORCHESTRATOR_ROLE) returns (uint256 escrowId) {
        if (agent == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroAmount();

        escrowId = _nextEscrowId++;
        _escrows[escrowId] = EscrowEntry({
            payer: msg.sender,
            agent: agent,
            amount: msg.value,
            status: Status.Locked
        });

        emit EscrowLocked(escrowId, msg.sender, agent, msg.value);
    }

    /// @notice Releases a locked escrow to its agent. Reverts if the
    /// escrow isn't currently `Locked` — including if it was already
    /// released or refunded, preventing double withdrawal.
    function releaseFunds(uint256 escrowId) external onlyRole(ORCHESTRATOR_ROLE) nonReentrant {
        EscrowEntry storage entry = _escrows[escrowId];
        if (entry.status != Status.Locked) revert EscrowNotLocked(escrowId);

        entry.status = Status.Released;
        uint256 amount = entry.amount;
        address agent = entry.agent;

        (bool success, ) = agent.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit EscrowReleased(escrowId, agent, amount);
    }

    /// @notice Refunds a locked escrow back to its payer. Same
    /// double-withdrawal protection as `releaseFunds`.
    function refundFunds(uint256 escrowId) external onlyRole(ORCHESTRATOR_ROLE) nonReentrant {
        EscrowEntry storage entry = _escrows[escrowId];
        if (entry.status != Status.Locked) revert EscrowNotLocked(escrowId);

        entry.status = Status.Refunded;
        uint256 amount = entry.amount;
        address payer = entry.payer;

        (bool success, ) = payer.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit EscrowRefunded(escrowId, payer, amount);
    }

    function getEscrow(uint256 escrowId) external view returns (EscrowEntry memory) {
        return _escrows[escrowId];
    }
}
