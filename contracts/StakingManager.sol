// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakingManager is ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    struct UserInfo { 
        uint256 deposited;
        uint256 autoCompounded;
        uint256 lastAutoCompounded;
    } //created user info structure

     mapping(address => UserInfo) public users; // mapped address of user to our userInfo structure

    uint256 public totalStaked; // total token deposited

    IERC20 public StakingToken; // liquidity pair of erc20 token and bnb/eth 

    IERC20 public RewardToken; //our erc20 token

    uint256 public rewardPerTOken; // reward per token

    uint256 public lastRewardTimeStamp; // last reward time stamp

    uint256 public rewardPeriodEndTimestamp;

    uint256 public accumulatedRewardPerShare;

    event AddRewards(uint256 amount, uint256 lengthInDays);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Harvest(address indexed user, uint256 amount);
    event WithdrawALL(address indexed user, uint256 amount);

    constructor(address _Stakingtoken, address _Rewardtoken) {
        StakingToken = IERC20(_Stakingtoken);
        RewardToken = IERC20(_Rewardtoken);
    }
// this function add reward token im our contract & _lengthindays this pool will run & give rewards
    function addRewards(uint256 _Amount, uint256 _lengthindays)
        external
        onlyOwner
        nonReentrant
    {
        require(RewardToken.balanceOf(msg.sender) >= _Amount);
        require(
            block.timestamp > rewardPeriodEndTimestamp,
            "cant add rewards before period finish"
        );
        updateRewards();
        rewardPeriodEndTimestamp = block.timestamp.add(
            _lengthindays.mul(24 * 60 * 60) 
        );
        rewardPerTOken = _Amount.mul(1e6).div(_lengthindays).div(24 * 60 * 60); //
        (
            RewardToken.transferFrom(msg.sender, address(this), _Amount),
            "transfer failed aprrove first  or you dont have enough token"
        );
        emit AddRewards(_Amount, _lengthindays);
    }
 // if the number of staking token get increased the reward will decrease
    function updateRewards() public {
        if (block.timestamp <= lastRewardTimeStamp) {
            return;
        }
        if (
            (totalStaked == 0) || lastRewardTimeStamp > rewardPeriodEndTimestamp
        ) {
            lastRewardTimeStamp = block.timestamp;
            return;
        }

        uint256 endingTime;
        if (block.timestamp > rewardPeriodEndTimestamp) {
            endingTime = rewardPeriodEndTimestamp;
        } else {
            endingTime = block.timestamp;
        }

        uint256 secondsSinceLastRewardUpdate = endingTime.sub(
            lastRewardTimeStamp
        );

        uint256 totalNewReward = secondsSinceLastRewardUpdate.mul(
            rewardPerTOken
        ); // For everybody in the pool

        accumulatedRewardPerShare = accumulatedRewardPerShare.add(
            totalNewReward.mul(1e12).div(totalStaked)
        );

        lastRewardTimeStamp = block.timestamp;

        if (block.timestamp > rewardPeriodEndTimestamp) {
            rewardPerTOken = 0;
        }
    }
    //deposit staking token
    function deposit(uint256 _amount) external nonReentrant {
        UserInfo storage user = users[msg.sender];
        require(StakingToken.balanceOf(msg.sender) >= _amount,"not enough token");
        updateRewards();
        user.deposited = user.deposited.add(_amount);
        totalStaked = totalStaked.add(_amount);
        (
            StakingToken.transferFrom(msg.sender, address(this), _amount),
            "You dont have enough token"
        );
        emit Deposit(msg.sender, _amount);
    }
    //withdraw you staking token
    function withdraw(uint256 _amount) external nonReentrant {
        UserInfo storage user = users[msg.sender];
        require(
            user.deposited >= _amount,
            "you are withdrawing more than you deposited"
        );
        updateRewards();
        user.deposited = user.deposited.sub(_amount);
        totalStaked = totalStaked.sub(_amount);
        StakingToken.transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }
    //withdraw all your token
    function withdrawAll() external nonReentrant {
        UserInfo storage user = users[msg.sender];
        require(
            user.deposited >= 0,
            "you are withdrawing more than you deposited"
        );
        updateRewards();
        RewardToken.transfer(msg.sender,user.autoCompounded);
        emit Harvest(msg.sender,user.autoCompounded);
        totalStaked = totalStaked.sub(user.deposited);
        StakingToken.transfer(msg.sender, user.deposited);
        emit WithdrawALL(msg.sender, user.deposited);
        user.deposited = 0;
        user.autoCompounded = 0;
    }
    //you can harvest  all of your reward token instead of autoCompound
    function HarvestToken() external nonReentrant {
        UserInfo storage user = users[msg.sender];
        if (user.deposited == 0) {
            return;
        }
        updateRewards();
        require(RewardToken.transfer(msg.sender, user.autoCompounded));
        emit Harvest(msg.sender, user.autoCompounded);
        user.autoCompounded = 0;
    }
    //you can autoCompund
       function autoCompound() external nonReentrant {
        UserInfo storage user = users[msg.sender];
        require(block.timestamp > user.lastAutoCompounded,"you cant autoCompound now wait for the cooldown" );
        if (user.deposited == 0) {
            return;
        }
        updateRewards();
        uint256 pending = user.autoCompounded.add(user
            .deposited
            .mul(accumulatedRewardPerShare)
            .div(1e12)
            .div(1e6));
      user.autoCompounded = user.autoCompounded.add(pending);
      user.lastAutoCompounded = block.timestamp.add(28800);
    }
    //shows your pending rewards
    function PendingRewards(address _user) public view returns (uint256) {
        UserInfo storage user = users[msg.sender];
        uint256 accumulated = accumulatedRewardPerShare;
        if (
            block.timestamp > lastRewardTimeStamp &&
            lastRewardTimeStamp <= rewardPeriodEndTimestamp &&
            totalStaked != 0
        ) {
            uint256 endtime;
            if (block.timestamp > rewardPeriodEndTimestamp) {
                endtime = rewardPeriodEndTimestamp;
            } else {
                endtime = block.timestamp;
            }

            uint256 secondsSinceLastRewardUpdate = endtime.sub(
                lastRewardTimeStamp
            );
            uint256 totalNewReward = secondsSinceLastRewardUpdate.mul(
                rewardPerTOken
            );
            accumulated = accumulated.add(
                totalNewReward.mul(1e12).div(totalStaked)
            );
        }
        return
           user.autoCompounded.add(user.deposited.mul(accumulated).div(1e12).div(1e6));
    }
    //details for ui
    function getFrontendView()
        external
        view
        returns (
            uint256 _rewardpersecond,
            uint256 _secondsleft,
            uint256 _deposited,
            uint256 _pending,
            uint256 _autoCompounded
        )
    {
        if (block.timestamp <= rewardPeriodEndTimestamp) {
            _secondsleft = rewardPeriodEndTimestamp.sub(block.timestamp);
            _rewardpersecond = rewardPerTOken.div(1e6);
        }
        _deposited = users[msg.sender].deposited;
        _pending = PendingRewards(msg.sender);
        _autoCompounded = users[msg.sender].autoCompounded;
    }
    //owner can withdraw remaining reward token after pools end
    function withdrawRemainingToken() external onlyOwner {
        require(block.timestamp > rewardPeriodEndTimestamp,"withdraw after pool reached its time");
        RewardToken.transfer(msg.sender,RewardToken.balanceOf(address(this)));
    }
}
