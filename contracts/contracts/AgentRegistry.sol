// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title VYRON Agent Registry
/// @notice On-chain directory of Agent Service Providers: skills, pricing,
/// availability, and reputation. VYRON's backend (ORCHESTRATOR_ROLE)
/// registers and updates agents; the Reputation contract (REPUTATION_ROLE)
/// is the only caller authorized to adjust reputation scores, keeping this
/// contract the single source of truth for an agent's current score.
contract AgentRegistry is AccessControl {
    bytes32 public constant ORCHESTRATOR_ROLE = keccak256("ORCHESTRATOR_ROLE");
    bytes32 public constant REPUTATION_ROLE = keccak256("REPUTATION_ROLE");

    enum Availability {
        Available,
        Busy,
        Offline
    }

    struct Agent {
        bool exists;
        string name;
        string[] skills;
        uint256 pricePerTask;
        Availability availability;
        int256 reputationScore;
    }

    mapping(address => Agent) private _agents;
    address[] private _agentAddresses;

    event AgentRegistered(address indexed agent, string name, uint256 pricePerTask);
    event AgentAvailabilityUpdated(address indexed agent, Availability availability);
    event AgentSkillsUpdated(address indexed agent, string[] skills);
    event AgentPricingUpdated(address indexed agent, uint256 pricePerTask);
    event AgentReputationUpdated(address indexed agent, int256 delta, int256 newScore);

    error AgentAlreadyRegistered(address agent);
    error AgentNotRegistered(address agent);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORCHESTRATOR_ROLE, admin);
    }

    function registerAgent(
        address agent,
        string calldata name,
        string[] calldata skills,
        uint256 pricePerTask
    ) external onlyRole(ORCHESTRATOR_ROLE) {
        if (_agents[agent].exists) revert AgentAlreadyRegistered(agent);

        _agents[agent] = Agent({
            exists: true,
            name: name,
            skills: skills,
            pricePerTask: pricePerTask,
            availability: Availability.Available,
            reputationScore: 500
        });
        _agentAddresses.push(agent);

        emit AgentRegistered(agent, name, pricePerTask);
    }

    function updateAvailability(address agent, Availability availability) external onlyRole(ORCHESTRATOR_ROLE) {
        _requireRegistered(agent);
        _agents[agent].availability = availability;
        emit AgentAvailabilityUpdated(agent, availability);
    }

    function updateSkills(address agent, string[] calldata skills) external onlyRole(ORCHESTRATOR_ROLE) {
        _requireRegistered(agent);
        _agents[agent].skills = skills;
        emit AgentSkillsUpdated(agent, skills);
    }

    function updatePricing(address agent, uint256 pricePerTask) external onlyRole(ORCHESTRATOR_ROLE) {
        _requireRegistered(agent);
        _agents[agent].pricePerTask = pricePerTask;
        emit AgentPricingUpdated(agent, pricePerTask);
    }

    /// @notice Applies a reputation delta (positive or negative). Callable
    /// only by the Reputation contract, which owns the business logic for
    /// *why* a score changes; this contract just stores the result.
    function applyReputationDelta(address agent, int256 delta) external onlyRole(REPUTATION_ROLE) returns (int256 newScore) {
        _requireRegistered(agent);
        newScore = _agents[agent].reputationScore + delta;
        _agents[agent].reputationScore = newScore;
        emit AgentReputationUpdated(agent, delta, newScore);
    }

    function getAgent(address agent) external view returns (Agent memory) {
        return _agents[agent];
    }

    /// @notice Dedicated scalar read used by the Reputation contract —
    /// avoids decoding the full struct (with its nested dynamic
    /// `skills` array) through an interface just to read one int256.
    function getReputationScore(address agent) external view returns (int256) {
        return _agents[agent].reputationScore;
    }

    function getAllAgents() external view returns (address[] memory) {
        return _agentAddresses;
    }

    function isRegistered(address agent) external view returns (bool) {
        return _agents[agent].exists;
    }

    function _requireRegistered(address agent) private view {
        if (!_agents[agent].exists) revert AgentNotRegistered(agent);
    }
}
