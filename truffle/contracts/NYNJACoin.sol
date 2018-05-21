pragma solidity 0.4.23;

import "../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

// @title   NYNJACoin
// @author  Jose Perez - <jose.perez@diginex.com>
// @dev     ERC20 token for NYNJA Mobile Communicator token sale.
contract NYNJACoin is StandardToken, Ownable {

    using SafeMath for uint256;
    using SafeMath for uint8;

    string public constant name = "NYNJACoin";
    string public constant symbol = "NYN";
    uint8 public constant decimals = 18;

    // Using same number of decimal figures as ETH (i.e. 18).
    uint256 public constant TOKEN_UNIT = 10 ** uint256(decimals);

    // Maximum number of tokens in circulation: 5 billion.
    uint256 public constant MAX_TOKEN_SUPPLY = (5 * 10 ** 9) * TOKEN_UNIT;

    address public assigner;    // The address allowed to assign or mint tokens during token sale.
    address public locker;      // The address allowed to lock/unlock addresses.

    mapping(address => bool) locked;        // If true, address' tokens cannot be transferred.

    uint8 public currentTokenSaleId = 0;    // The id of the current token sale.
    mapping(address => uint8) tokenSaleId;  // In which token sale the address first participated.

    bool public tokenSaleOngoing = false;

    event TokenSaleStarting(uint indexed tokenSaleId);
    event TokenSaleEnding(uint indexed tokenSaleId);
    event Lock(address indexed addr);
    event Unlock(address indexed addr);
    event Assign(address indexed to, uint256 amount);
    event Mint(address indexed to, uint256 amount);
    event LockerTransferred(address indexed previousLocker, address indexed newLocker);
    event AssignerTransferred(address indexed previousAssigner, address indexed newAssigner);


    // @dev True if a token sale is ongoing.
    modifier tokenSaleIsOngoing() {
        require(tokenSaleOngoing);
        _;
    }

    // @dev True if a token sale is not ongoing.
    modifier tokenSaleIsNotOngoing() {
        require(!tokenSaleOngoing);
        _;
    }

    // @dev Throws if called by any account other than the assigner.
    modifier onlyAssigner() {
        require(msg.sender == assigner);
        _;
    }

    // @dev Throws if called by any account other than the locker.
    modifier onlyLocker() {
        require(msg.sender == locker);
        _;
    }

    /// @dev Constructor that initializes the NYNJACoin contract.
    /// @param _assigner The assigner account.
    /// @param _locker The locker account.
    constructor(address _assigner, address _locker) public {
        require(_assigner != address(0));
        require(_locker != address(0));

        assigner = _assigner;
        locker = _locker;
    }

    // @dev Starts a new token sale. Only the owner can start a new token sale. If a token sale
    //      is ongoing, it has to be ended before a new token sale can be started.
    // @return True if the operation was successful.
    function tokenSaleStart() external onlyOwner tokenSaleIsNotOngoing returns(bool) {
        currentTokenSaleId++;
        tokenSaleOngoing = true;
        emit TokenSaleStarting(currentTokenSaleId);
        return true;
    }

    // @dev Ends the current token sale. Only the owner can end a token sale.
    // @return True if the operation was successful.
    function tokenSaleEnd() external onlyOwner tokenSaleIsOngoing returns(bool) {
        emit TokenSaleEnding(currentTokenSaleId);
        tokenSaleOngoing = false;
        return true;
    }

    // @return Returns whether or not a token sale is ongoing.
    function isTokenSaleOngoing() external view returns(bool) {
        return tokenSaleOngoing;
    }    

    // @return Returns current token sale id.
    function getCurrentTokenSaleId() external view returns(uint8) {
        return currentTokenSaleId;
    }

    // @return Returns the id of the last token sale that the address participated in.
    function getAddressTokenSaleId(address _address) external view returns(uint8) {
        return tokenSaleId[_address];
    }

    // @dev Allows the current owner to change the assigner.
    // @param newAssigner The address of the new assigner.
    // @return True if the operation was successful.
    function transferAssigner(address newAssigner) external onlyOwner returns(bool) {
        require(newAssigner != address(0));

        emit AssignerTransferred(assigner, newAssigner);
        assigner = newAssigner;
        return true;
    }

    // @dev Function to mint tokens. It can only be called by the assigner during an ongoing token sale.
    // @param _to The address that will receive the minted tokens.
    // @param _amount The amount of tokens to mint.
    // @return A boolean that indicates if the operation was successful.
    function mint(address _to, uint256 _amount) public onlyAssigner tokenSaleIsOngoing returns(bool) {
        totalSupply_ = totalSupply_.add(_amount);
        require(totalSupply_ <= MAX_TOKEN_SUPPLY);

        balances[_to] = balances[_to].add(_amount);
        tokenSaleId[_to] = currentTokenSaleId;
        emit Mint(_to, _amount);
        emit Transfer(address(0), _to, _amount);
        return true;
    }

    // @dev Mints tokens for several addresses in one single call.
    // @param _to address[] The addresses that get the tokens.
    // @param _amount address[] The number of tokens to be minted.
    // @return A boolean that indicates if the operation was successful.
    function mintInBatches(address[] _to, uint256[] _amount) external onlyAssigner tokenSaleIsOngoing returns(bool) {
        require(_to.length > 0);
        require(_to.length == _amount.length);

        for (uint i = 0; i < _to.length; i++) {
            mint(_to[i], _amount[i]);
        }
        return true;
    }

    // @dev Function to assign tokens
    // @param _to The address that will receive the assigned tokens.
    // @param _amount The amount of tokens to assign.
    // @return True if the operation was successful.
    function assign(address _to, uint256 _amount) public onlyAssigner tokenSaleIsOngoing returns(bool) {
        uint256 delta = 0;
        if (balances[_to] < _amount) {
            delta = _amount.sub(balances[_to]);
            totalSupply_ = totalSupply_.add(delta);
        } else {
            delta = balances[_to].sub(_amount);
            totalSupply_ = totalSupply_.sub(delta);
        }
        require(totalSupply_ <= MAX_TOKEN_SUPPLY);

        balances[_to] = _amount;
        tokenSaleId[_to] = currentTokenSaleId;

        emit Assign(_to, _amount);
        emit Transfer(address(0), _to, _amount);
        return true;
    }

    // @dev Assigns tokens to several addresses in one call.
    // @param _to address[] The addresses that get the tokens.
    // @param _amount address[] The number of tokens to be assigned.
    // @return True if the operation was successful.
    function assignInBatches(address[] _to, uint256[] _amount) external onlyAssigner tokenSaleIsOngoing returns(bool) {
        require(_to.length > 0);
        require(_to.length == _amount.length);

        for (uint i = 0; i < _to.length; i++) {
            assign(_to[i], _amount[i]);
        }
        return true;
    }

    // @dev Allows the current owner to change the locker.
    // @param newLocker The address of the new locker.
    // @return True if the operation was successful.
    function transferLocker(address newLocker) external onlyOwner returns(bool) {
        require(newLocker != address(0));

        emit LockerTransferred(locker, newLocker);
        locker = newLocker;
        return true;
    }

    // @dev Locks an address from token trading. Only addresses participating in the current token sale can be locked.
    //      Only the locker account can lock addresses.
    // @param _address address The address to lock.
    // @return True if the operation was successful.
    function lockAddress(address _address) public onlyLocker tokenSaleIsOngoing returns(bool) {
        require(tokenSaleId[_address] == currentTokenSaleId);
        require(!locked[_address]);

        locked[_address] = true;
        emit Lock(_address);
        return true;
    }

    // @dev Unlocks an address to allow trading its tokens. Only the locker account can unlock addresses.
    // @param _address address The address to unlock.
    // @return True if the operation was successful.
    function unlockAddress(address _address) public onlyLocker returns(bool) {
        require(locked[_address]);
        locked[_address] = false;
        emit Unlock(_address);
        return true;
    }

    // @dev Locks several addresses from trading in one single call.
    // @param _addresses address[] The addresses to lock from trading.
    // @return True if the operation was successful.
    function lockInBatches(address[] _addresses) external onlyLocker returns(bool) {
        require(_addresses.length > 0);
        for (uint i = 0; i < _addresses.length; i++) {
            lockAddress(_addresses[i]);
        }
        return true;
    }

    // @dev Unlocks several addresses from trading in one single call.
    // @param _addresses address[] The addresses to unlock from trading.
    // @return True if the operation was successful.
    function unlockInBatches(address[] _addresses) external onlyLocker returns(bool) {
        require(_addresses.length > 0);
        for (uint i = 0; i < _addresses.length; i++) {
            unlockAddress(_addresses[i]);
        }
        return true;
    }

    // @dev Checks whether or not the given address is locked.
    // @param _address address The address to be checked.
    // @return Boolean indicating whether or not the address is locked.
    function isLocked(address _address) external view returns(bool) {
        return locked[_address];
    }

    // @dev Transfers tokens to the specified address. It prevents transferring tokens from a locked address.
    //      Locked addresses can be transferred tokens.
    // @param _to The address to transfer tokens to.
    // @param _value The number of tokens to be transferred.
    function transfer(address _to, uint256 _value) public returns(bool) {
        require(!locked[msg.sender]);
        if (tokenSaleOngoing) {
            require(tokenSaleId[msg.sender] < currentTokenSaleId);
            require(tokenSaleId[_to] < currentTokenSaleId);
        }
        return super.transfer(_to, _value);
    }

    // @dev Transfers tokens from one address to another.  It prevents transferring tokens if the caller is locked and
    //      from a locked address.
    // @param _from address The address to transfer tokens from.
    // @param _to address The address to transfer tokens to.
    // @param _value The number of tokens to be transferred.
    function transferFrom(address _from, address _to, uint256 _value) public returns(bool) {
        require(!locked[msg.sender]);
        require(!locked[_from]);
        if (tokenSaleOngoing) {
            require(tokenSaleId[msg.sender] < currentTokenSaleId);
            require(tokenSaleId[_from] < currentTokenSaleId);
            require(tokenSaleId[_to] < currentTokenSaleId);
        }
        return super.transferFrom(_from, _to, _value);
    }
}
