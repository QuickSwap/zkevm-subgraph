/* eslint-disable prefer-const */
import { CUSTOM_WDOGE_PRICE, ONE_BD, ZERO_BD, ZERO_BI } from './constants'
import { Bundle, Pool, Token } from './../types/schema'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { exponentToBigDecimal, safeDiv } from '../utils/index'

const WMatic_ADDRESS = '0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101'//WWDOGE
const USDC_WWDOGE_03_POOL = '0x5a3b7b4829dffe1effd44c938372b15577646e96'// WWDOGE-USDC(ROUTER-NITRO)

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export let WHITELIST_TOKENS: string[] = [
  "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101", //WDOGE
  '0xff13a7a12fd485bc9687ff88d8ae1a6b655ab469', // WETH
  '0xdc42728b0ea910349ed3c6e1c9dc06b5fb591f98', //MATIC
  '0xd95086fe465a2dc59f989b927472a901e2e05ff2', //USDO
  '0xb6dc6c8b71e88642cead3be1025565a9ee74d1c6', //USDT
  '0x97eec1c29f745dc7c267f90292aa663d997a601d', //USDC
  '0x582daef1f36d6009f64b74519cfd612a8467be18', //DD
  '0xfa9343c3897324496a05fc75abed6bac29f8a40f', //WBTC
  '0xb12c13e66ade1f72f71834f2fc5082db8c091358', //QUICK
  '0x7b4328c127b85369d9f82ca0503b000d09cf9180', //DC
  '0xf480f38c366daac4305dc484b2ad7a496ff00cea', //DOGIRA
  '0x91cd28e57b92e34124c4540ee376c581d188b53e', //DCGOD
  '0xB9fcAa7590916578087842e017078D7797Fa18D0', //DOGETOOLS
  '0x35EA0c670eD9f54Ac07B648aCF0F2EB173A6012D' //TDH
]

let MINIMUM_Matic_LOCKED = BigDecimal.fromString('100')

let Q192 = Math.pow(2, 192)

let STABLE_COINS: string[] = [
  '0xd95086fe465a2dc59f989b927472a901e2e05ff2', // USDO
  '0xb6dc6c8b71e88642cead3be1025565a9ee74d1c6', //USDT
  '0x97eec1c29f745dc7c267f90292aa663d997a601d' //USDC
]


export function priceToTokenPrices(price: BigInt, token0: Token, token1: Token): BigDecimal[] {
  let num = price.times(price).toBigDecimal()
  let denom = BigDecimal.fromString(Q192.toString())
  let price1 = num
    .div(denom)
    .times(exponentToBigDecimal(token0.decimals))
    .div(exponentToBigDecimal(token1.decimals))

  let price0 = safeDiv(BigDecimal.fromString('1'), price1)
  return [price0, price1]
}

export function getEthPriceInUSD(): BigDecimal {
  let usdcPool = Pool.load(USDC_WWDOGE_03_POOL) // WETH is token0
  if (usdcPool !== null) {
    return usdcPool.token0Price
  } else {
    return CUSTOM_WDOGE_PRICE
  }
} 


/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived Matic (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WMatic_ADDRESS) {
    return ONE_BD
  }
  let whiteList = token.whitelistPools
  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let largestLiquidityMatic = ZERO_BD
  let priceSoFar = ZERO_BD
  let bundle = Bundle.load('1')

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (STABLE_COINS.includes(token.id)) {
    priceSoFar = safeDiv(ONE_BD, bundle!.maticPriceUSD)
  } else {
  for (let i = 0; i < whiteList.length; ++i) {
    let poolAddress = whiteList[i]
    let pool = Pool.load(poolAddress)!
    if (pool.liquidity.gt(ZERO_BI)) {

      if (pool.token0 == token.id) {
        // whitelist token is token1
        let token1 = Token.load(pool.token1)!
        // get the derived Matic in pool
        let maticLocked = pool.totalValueLockedToken1.times(token1.derivedMatic)
        if (maticLocked.gt(largestLiquidityMatic) && maticLocked.gt(MINIMUM_Matic_LOCKED)) {
          largestLiquidityMatic = maticLocked
          // token1 per our token * Eth per token1
          priceSoFar = pool.token1Price.times(token1.derivedMatic as BigDecimal)
        }
      }
      if (pool.token1 == token.id) {
        let token0 = Token.load(pool.token0)!
        // get the derived Matic in pool
        let maticLocked = pool.totalValueLockedToken0.times(token0.derivedMatic)
        if (maticLocked.gt(largestLiquidityMatic) && maticLocked.gt(MINIMUM_Matic_LOCKED)) {
          largestLiquidityMatic = maticLocked
          // token0 per our token * Matic per token0
          priceSoFar = pool.token0Price.times(token0.derivedMatic as BigDecimal)
        }
      }
    }
  }
}
  return priceSoFar // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')!
  let price0USD = token0.derivedMatic.times(bundle.maticPriceUSD)
  let price1USD = token1.derivedMatic.times(bundle.maticPriceUSD)

  // both are whitelist tokens, return sum of both amounts
  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD
}
