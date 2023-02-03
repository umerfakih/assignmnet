const { expect } = require('chai')
const { ethers } = require('hardhat')

const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

describe('Staking', function () {
  let owner, addr1, addr2, StakingManager, StakingToken, RewardToken
  let secondsInDay = 24 * 60 * 60
  let day = 30

  beforeEach(async function () {
    const stakingtoken = await ethers.getContractFactory('StakingToken')
    const rewardtoken = await ethers.getContractFactory('RewardToken')
    const stakingManager = await ethers.getContractFactory('StakingManager')
    ;[owner, addr1, addr2] = await ethers.getSigners()
    StakingToken = await stakingtoken.deploy()
    RewardToken = await rewardtoken.deploy()
    StakingManager = await stakingManager.deploy(
      StakingToken.address,
      RewardToken.address,
    )
  })

  describe('checking', function () {
    it('Should check check the owner of the contract & check staking , reward token address', async () => {
      expect(await StakingToken.owner()).to.equal(owner.address)
      expect(await RewardToken.owner()).to.equal(owner.address)
      expect(await StakingManager.owner()).to.equal(owner.address)
      expect(await StakingManager.StakingToken()).to.equal(StakingToken.address)
      expect(await StakingManager.RewardToken()).to.equal(RewardToken.address)
    })

    it('should check adding reward correctly', async () => {
      await RewardToken.approve(StakingManager.address, toWei(300))
      expect(
        await RewardToken.allowance(owner.address, StakingManager.address),
      ).to.equal(toWei(300))

      await StakingManager.addRewards(toWei(300), day)

      expect(await RewardToken.balanceOf(StakingManager.address)).to.equal(
        toWei(300),
      )
    })
    it('should fail adding reward because its only owner', async () => {
      await RewardToken.transfer(addr1.address, toWei(300))
      await RewardToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )
      await expect(
        StakingManager.connect(addr1).addRewards(toWei(300), day),
      ).to.revertedWith('Ownable: caller is not the owner')
    })

    it('should fail adding reward before time ends', async () => {
      await RewardToken.approve(StakingManager.address, toWei(300))
      expect(
        await RewardToken.allowance(owner.address, StakingManager.address),
      ).to.equal(toWei(300))

      await StakingManager.addRewards(toWei(300), day)

      expect(await RewardToken.balanceOf(StakingManager.address)).to.equal(
        toWei(300),
      )

      await RewardToken.approve(StakingManager.address, toWei(300))
      expect(
        await RewardToken.allowance(owner.address, StakingManager.address),
      ).to.equal(toWei(300))

      await expect(StakingManager.addRewards(toWei(300), day)).to.revertedWith(
        'cant add rewards before period finish',
      )
    })

    it('should  deposit token', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await StakingToken.approve(StakingManager.address, toWei(300))
      await StakingManager.deposit(toWei(300))
      expect(await StakingManager.totalStaked()).to.equal(toWei(300))
      const userInfo = await StakingManager.users(owner.address)
      expect(userInfo.deposited).to.equal(toWei(300))
    })

    it('should  fail deposit token', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))

      await StakingManager.addRewards(toWei(1000), day)

      await StakingToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )
      await expect(
        StakingManager.connect(addr1).deposit(toWei(300)),
      ).to.revertedWith('not enough token')
    })

    it('should withdraw', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await StakingToken.transfer(addr1.address, toWei(300))
      expect(await StakingToken.balanceOf(addr1.address)).to.equal(toWei(300))
      await StakingToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )
      await StakingManager.connect(addr1).deposit(toWei(300))
      expect(await StakingToken.balanceOf(addr1.address)).to.equal(0)
      await StakingManager.connect(addr1).withdraw(toWei(100))
      expect(await StakingToken.balanceOf(addr1.address)).to.equal(toWei(100))
      expect(await StakingManager.totalStaked()).to.equal(toWei(200))
    })
    it('should fail withdraw', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await expect(
        StakingManager.connect(addr1).withdraw(toWei(100)),
      ).to.revertedWith('you are withdrawing more than you deposited')
    })
    it('should withdrawAll', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await StakingToken.transfer(addr1.address, toWei(300))
      await StakingToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )

      await StakingManager.connect(addr1).deposit(toWei(300))
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await StakingManager.connect(addr1).autoCompound()
      const balance = await StakingManager.connect(addr1).users(addr1.address)
      await StakingManager.connect(addr1).withdrawAll()
      expect(await StakingToken.balanceOf(addr1.address)).to.equal(
        balance.deposited,
      )
      expect(
        await RewardToken.connect(addr1).balanceOf(addr1.address),
      ).to.equal(balance.autoCompounded)
    })
    it('should autoCompound', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await StakingToken.transfer(addr1.address, toWei(300))
      await StakingToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )
      await StakingManager.connect(addr1).deposit(toWei(300))
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await StakingManager.connect(addr1).autoCompound()
      const balance = await StakingManager.connect(addr1).users(addr1.address)
      const frontEndView = await StakingManager.connect(addr1).getFrontendView()
      expect(balance.autoCompounded).to.equal(frontEndView._autoCompounded)
    })

    it('should faile auto compound need to wait for 8 hours', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await StakingToken.transfer(addr1.address, toWei(300))
      await StakingToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )
      await StakingManager.connect(addr1).deposit(toWei(300))
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await StakingManager.connect(addr1).autoCompound()
      await expect(
        StakingManager.connect(addr1).autoCompound(),
      ).to.revertedWith('you cant autoCompound now wait for the cooldown')
    })
    it('should harvest reward token', async () => {
      await RewardToken.approve(StakingManager.address, toWei(1000))
      await StakingManager.addRewards(toWei(1000), day)
      await StakingToken.transfer(addr1.address, toWei(300))
      await StakingToken.connect(addr1).approve(
        StakingManager.address,
        toWei(300),
      )
      await StakingManager.connect(addr1).deposit(toWei(300))
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await StakingManager.connect(addr1).autoCompound()
      const balance = await StakingManager.connect(addr1).users(addr1.address)
      await StakingManager.connect(addr1).HarvestToken()
      expect(await RewardToken.balanceOf(addr1.address)).to.equal(
        balance.autoCompounded,
      )
    })
    it('should fail withdraw remaining reward token because pool is still active', async () => {
      await RewardToken.approve(StakingManager.address, toWei(300))
      expect(
        await RewardToken.allowance(owner.address, StakingManager.address),
      ).to.equal(toWei(300))

      await StakingManager.addRewards(toWei(300), day)
      await expect(StakingManager.withdrawRemainingToken()).to.revertedWith(
        'withdraw after pool reached its time',
      )
    })
  })
})
