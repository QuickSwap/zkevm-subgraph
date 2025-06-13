import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';

export const FarmingCenterAddress = Address.fromString("0x82831e9565cb574375596efc090da465283e22a4")

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)