import {describe,it,expect} from 'vitest';
import {normalizeClass,availableBudget,gateProposal,headlineEligible} from './domain';
describe('closed economy and budget boundary',()=>{
  it('never promotes internal names or unverified strangers',()=>{
    expect(normalizeClass('@Abu_olododo','independent','0x1',['0x1'])).toBe('internal');
    expect(normalizeClass('Other team','independent','0x1')).toBe('unverified');
    expect(normalizeClass('Other team','unverified','0x1',['0x1'])).toBe('independent');
    expect(normalizeClass('friend','internal','0x1',['0x1'])).toBe('internal');
  });
  it('reserves unpaid admits and turns an unaffordable admission into wait',()=>{
    const remaining=availableBudget(20n,0n,10n,2);
    expect(remaining).toBe(0n);
    expect(gateProposal({decision:'admit',reason:'Meets all requirements',evidence:['brief']},remaining,10n).decision).toBe('wait');
  });
  it('counts only confirmed independent completed payments',()=>{
    expect(headlineEligible('internal','independent',true,true)).toBe(false);
    expect(headlineEligible('independent','unverified',true,true)).toBe(false);
    expect(headlineEligible('independent','independent',true,false)).toBe(false);
    expect(headlineEligible('independent','independent',true,true)).toBe(true);
  });
});
