import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteRequestPath,safeQuoteReturn,validateQuoteForm } from '../src/lib/quoteRequests.js';
import { validateProduct } from '../src/admin/catalogValidation.js';
import { resolveProductPrice } from '../src/lib/storePricing.js';

test('quotation return survives service/product parameters without accepting an external redirect',()=>{
  for(const path of [quoteRequestPath({service:'weekly_flowers'}),quoteRequestPath({product:'abc',quantity:3}),quoteRequestPath({source:'cart'})]) assert.equal(safeQuoteReturn(path),path);
  for(const path of ['https://example.test','//example.test/request-quote','/request-quote/other','/request-quote\n?service=custom','/checkout']) assert.equal(safeQuoteReturn(path),null);
});
test('quotation-priced products accept an empty selling price and cannot acquire a price through discounts',()=>{
  const product={name_ar:'شجرة',name_en:'Tree',price_on_request:true,base_price:'',sale_price:'',stock_mode:'made_to_order',min_order_quantity:1,max_order_quantity:'',stock_quantity:0,cost_price:'',target_margin_percent:30,low_stock_threshold:0};
  assert.equal(validateProduct(product),null);
  const resolved=resolveProductPrice(product,[{is_active:true,scope:'all',rule_type:'fixed_price',value:50}]);
  assert.equal(resolved.effective,null);assert.equal(resolved.source,'request');
});
test('quotation contact details require enough information to follow up',()=>{
  const form={contact_name:'عميل بلقيس',phone:'0500000000',email:'client@example.test',location:'مكة المكرمة',description:'عقد ورد أسبوعي لتنسيق استقبال المنشأة'};
  assert.equal(validateQuoteForm(form,true),'');
  assert.ok(validateQuoteForm({...form,phone:'123'},true));
  assert.ok(validateQuoteForm({...form,description:'ورد'},true));
  assert.ok(validateQuoteForm({...form,email:'invalid'},true));
});
