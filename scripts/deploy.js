const { ethers } = require('hardhat')
async function main() {
  const Token = await ethers.getContractFactory('Staking')
  const token = await NFT.deploy()

  const StakinManager = await ethers.getContractFactory('StakingManager')
  const stakingManager = await Marketplace.deploy(
    'Add your token & bnb liquidity pair or any staking token you want',
    token.address,
  )
  console.log('Token ADDRESS:', token.address)
  console.log('StakinManager ADDRESS:', stakingManager.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
