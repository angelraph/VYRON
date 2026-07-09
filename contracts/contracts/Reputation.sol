// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IAgentRegistry {
    function applyReputationDelta(address agent, int256 delta) external returns (int256 newScore);
    function getReputationScore(address agent) external view returns (int256);
}

/// @title VYRON Reputation
/// @notice Records *why* an agent's reputation changes (successful
/// completion vs. failure) and applies the resulting delta to the Agent
/// Registry, which remains the single source of truth for the current
/// score. VYRON's backend (ORCHESTRATOR_ROLE) is the only caller.
contract Reputation is AccessControl {
    bytes32 public constant ORCHESTRATOR_ROLE = keccak256("ORCHESTRATOR_ROLE");

    IAgentRegistry public immutable agentRegistry;

    event ReputationIncreased(address indexed agent, int256 amount, int256 newScore, string reason);
    event ReputationDecreased(address indexed agent, int256 amount, int256 newScore, string reason);

    error ZeroAmount();

    constructor(address admin, address agentRegistryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORCHESTRATOR_ROLE, admin);
        agentRegistry = IAgentRegistry(agentRegistryAddress);
    }

    /// @notice Increases an agent's reputation after a successfully
    /// verified, paid task.
    function recordSuccess(address agent, int256 amount, string calldata reason) external onlyRole(ORCHESTRATOR_ROLE) {
        if (amount <= 0) revert ZeroAmount();
        int256 newScore = agentRegistry.applyReputationDelta(agent, amount);
        emit ReputationIncreased(agent, amount, newScore, reason);
    }

    /// @notice Decreases an agent's reputation after a failure (stalled
    /// delivery, reassignment, disputed work).
    function recordFailure(address agent, int256 amount, string calldata reason) external onlyRole(ORCHESTRATOR_ROLE) {
        if (amount <= 0) revert ZeroAmount();
        int256 newScore = agentRegistry.applyReputationDelta(agent, -amount);
        emit ReputationDecreased(agent, amount, newScore, reason);
    }

    function getReputationScore(address agent) external view returns (int256) {
        return agentRegistry.getReputationScore(agent);
    }
}
