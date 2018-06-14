pragma solidity 0.4.23;

import '../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './NYNJACoin.sol';

/// @title  VestingTrustee
/// @author Jose Perez - <jose.perez@diginex.com>
/// @notice Vesting trustee contract for NYNJACoin ERC20 tokens. Tokens are granted to specific
///         addresses and vested under certain criteria (vesting period, cliff period, etc.)
///         Tokens must be transferred to the VestingTrustee contract address prior to granting them.
contract VestingTrustee is Ownable {
    using SafeMath for uint256;

    // NYNJA's ERC20 contract.
    NYNJACoin public nynja;

    // The address allowed to grant and revoke tokens.
    address public vester;

    // Vesting grant for a specific holder.
    struct Grant {
        uint256 value;
        uint256 start;
        uint256 cliff;
        uint256 end;
        uint256 installmentLength; // In seconds.
        uint256 transferred;
        bool revocable;
    }

    // Holder to grant information mapping.
    mapping (address => Grant) public grants;

    // Total tokens available for vesting.
    uint256 public totalVesting;

    event NewGrant(address indexed _from, address indexed _to, uint256 _value);
    event TokensUnlocked(address indexed _to, uint256 _value);
    event GrantRevoked(address indexed _holder, uint256 _refund);
    event VesterTransferred(address indexed previousVester, address indexed newVester);

    /// @dev Constructor that initializes the VestingTrustee contract.
    /// @param _nynja The address of the previously deployed NYNJA token contract.
    /// @param _vester The vester address.
    constructor(NYNJACoin _nynja, address _vester) public {
        require(_nynja != address(0));
        require(_vester != address(0));

        nynja = _nynja;
        vester = _vester;
    }

    // @dev Prevents being called by any account other than the vester.
    modifier onlyVester() {
        require(msg.sender == vester);
        _;
    }

    /// @dev Allows the owner to change the vester.
    /// @param _newVester The address of the new vester.
    /// @return True if the operation was successful.
    function transferVester(address _newVester) external onlyOwner returns(bool) {
        require(_newVester != address(0));

        emit VesterTransferred(vester, _newVester);
        vester = _newVester;
        return true;
    }
    

    /// @dev Grant tokens to a specified address. All time units are in seconds since Unix epoch.
    ///      Tokens must be transferred to the VestingTrustee contract address prior to calling this
    ///      function. The number of tokens assigned to the VestingTrustee contract address must
    //       always be equal or greater than the total number of vested tokens.
    /// @param _to address The holder address.
    /// @param _value uint256 The amount of tokens to be granted.
    /// @param _start uint256 The beginning of the vesting period.
    /// @param _cliff uint256 Time, between _start and _end, when the first installment is made.
    /// @param _end uint256 The end of the vesting period.
    /// @param _installmentLength uint256 The length of each vesting installment.
    /// @param _revocable bool Whether the grant is revocable or not.
    function grant(address _to, uint256 _value, uint256 _start, uint256 _cliff, uint256 _end,
        uint256 _installmentLength, bool _revocable)
        external onlyVester {

        require(_to != address(0));
        require(_to != address(this)); // Don't allow holder to be this contract.
        require(_value > 0);

        // Require that every holder can be granted tokens only once.
        require(grants[_to].value == 0);

        // Require for time ranges to be consistent and valid.
        require(_start <= _cliff && _cliff <= _end);

        // Require installment length to be valid and no longer than (end - start).
        require(_installmentLength > 0 && _installmentLength <= _end.sub(_start));

        // Grant must not exceed the total amount of tokens currently available for vesting.
        require(totalVesting.add(_value) <= nynja.balanceOf(address(this)));

        // Assign a new grant.
        grants[_to] = Grant({
            value: _value,
            start: _start,
            cliff: _cliff,
            end: _end,
            installmentLength: _installmentLength,
            transferred: 0,
            revocable: _revocable
        });

        // Since tokens have been granted, increase the total amount of vested tokens.
        // This indirectly reduces the total amount available for vesting.
        totalVesting = totalVesting.add(_value);

        emit NewGrant(msg.sender, _to, _value);
    }

    /// @dev Revoke the grant of tokens of a specified grantee address.
    ///      The vester can arbitrarily revoke the tokens of a revocable grant anytime.
    ///      However, the grantee owns `calculateVestedTokens` number of tokens, even if some of them
    ///      have not been transferred to the grantee yet. Therefore, the `revoke` function should
    ///      transfer all non-transferred tokens to their rightful owner. The rest of the granted tokens
    ///      should be transferred to the vester.
    /// @param _holder The address which will have its tokens revoked.
    function revoke(address _holder) public onlyVester {
        Grant memory holderGrant = grants[_holder];

        // Grant must be revocable.
        require(holderGrant.revocable);

        // Calculate number of tokens to be transferred to vester and to holder:
        // holderGrant.value = toVester + vested = toVester + ( toHolder + holderGrant.transferred )
        uint256 vested = calculateVestedTokens(holderGrant, now);
        uint256 toVester = holderGrant.value.sub(vested);
        uint256 toHolder = vested.sub(holderGrant.transferred);

        // Remove grant information.
        delete grants[_holder];

        // Update totalVesting.
        totalVesting = totalVesting.sub(toHolder);
        totalVesting = totalVesting.sub(toVester);

        // Transfer tokens.
        nynja.transfer(_holder, toHolder);
        nynja.transfer(vester, toVester);
        
        emit GrantRevoked(_holder, toVester);
    }

    /// @dev Calculate amount of vested tokens at a specifc time.
    /// @param _grant Grant The vesting grant.
    /// @param _time uint256 The time to be checked
    /// @return a uint256 Representing the amount of vested tokens of a specific grant.
    function calculateVestedTokens(Grant _grant, uint256 _time) private pure returns (uint256) {
        // If we're before the cliff, then nothing is vested.
        if (_time < _grant.cliff) {
            return 0;
        }

        // If we're after the end of the vesting period - everything is vested;
        if (_time >= _grant.end) {
            return _grant.value;
        }

        // Calculate amount of installments past until now.
        // NOTE: result gets floored because of integer division.
        uint256 installmentsPast = _time.sub(_grant.start).div(_grant.installmentLength);

        // Calculate amount of days in entire vesting period.
        uint256 vestingDays = _grant.end.sub(_grant.start);

        // Calculate and return installments that have passed according to vesting days that have passed.
        return _grant.value.mul(installmentsPast.mul(_grant.installmentLength)).div(vestingDays);
    }

    /// @dev Calculate the total amount of vested tokens of a holder at a given time.
    /// @param _holder address The address of the holder.
    /// @param _time uint256 The specific time to calculate against.
    /// @return a uint256 Representing a holder's total amount of vested tokens.
    function vestedTokens(address _holder, uint256 _time) external view returns (uint256) {
        Grant memory holderGrant = grants[_holder];

        if (holderGrant.value == 0) {
            return 0;
        }

        return calculateVestedTokens(holderGrant, _time);
    }

    /// @dev Unlock vested tokens and transfer them to their holder.
    /// @param _holder address The address of the holder.
    function unlockVestedTokens(address _holder) external {
        Grant storage holderGrant = grants[_holder];

        // Require that there will be funds left in grant to transfer to holder.
        require(holderGrant.value.sub(holderGrant.transferred) > 0);

        // Get the total amount of vested tokens, according to grant.
        uint256 vested = calculateVestedTokens(holderGrant, now);
        if (vested == 0) {
            return;
        }

        // Make sure the holder doesn't transfer more than what he already has.
        uint256 transferable = vested.sub(holderGrant.transferred);
        if (transferable == 0) {
            return;
        }

        // Update transferred and total vesting amount, then transfer remaining vested funds to holder.
        holderGrant.transferred = holderGrant.transferred.add(transferable);
        totalVesting = totalVesting.sub(transferable);
        nynja.transfer(_holder, transferable);

        emit TokensUnlocked(_holder, transferable);
    }
}
