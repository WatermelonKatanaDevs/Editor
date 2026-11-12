'use strict';

const assert = require('node:assert/strict');
const LocalAI = require('../../../localai.js');
const {createProviderClient} = LocalAI;

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {'content-type':'application/json', ...headers}
  });
}

function registry(model, definitions = {}) {
  return {
    active: () => model,
    providerForModel: value => value.provider || 'custom',
    provider: id => definitions[id] || {}
  };
}

function create(model, transport, options = {}) {
  const providers = options.providers || registry(model, options.providerDefinitions);
  return createProviderClient({
    providers,
    transport,
    resolveAuth: options.resolveAuth || (() => 'test-token'),
    getPreferences: options.getPreferences || (() => ({})),
    analytics: options.analytics,
    events: options.events,
    sleep: options.sleep || (async () => {}),
    random: () => 0,
    localExecutor: options.localExecutor
  });
}

async function test(name, fn) {
  await fn();
  process.stdout.write('✓ ' + name + '\n');
}

(async () => {
  await test('OpenAI Chat Completions request, auth, tools and reasoning normalization', async () => {
    const model = {id:'chat',provider:'custom',model:'chat-model',protocol:'openai-chat',endpoint:'https://api.example.test/v1',supportsTools:true};
    let request;
    const client = create(model, async (url, init) => {
      request = {url, init, body:JSON.parse(init.body)};
      return jsonResponse({choices:[{message:{
        content:'Hello',
        reasoning_content:'considered',
        tool_calls:[{id:'call-1',type:'function',function:{name:'lookup',arguments:'{"q":"x"}'}}]
      }}],usage:{prompt_tokens:3,completion_tokens:4,total_tokens:7}});
    });
    const result = await client.complete([{role:'user',content:'hi'}], {
      tools:[{type:'function',function:{name:'lookup',description:'Look up',parameters:{type:'object',properties:{q:{type:'string'}}}}}]
    });
    assert.equal(request.url,'https://api.example.test/v1/chat/completions');
    assert.equal(request.init.headers.Authorization,'Bearer test-token');
    assert.equal(request.body.messages[0].content,'hi');
    assert.equal(request.body.tools[0].function.name,'lookup');
    assert.equal(result.content,'Hello');
    assert.equal(result.reasoning_content,'considered');
    assert.equal(result.tool_calls[0].function.name,'lookup');
    assert.equal(result.tool_calls[0].function.arguments,'{"q":"x"}');
  });

  await test('OpenAI Responses request and output normalization', async () => {
    const model = {id:'responses',model:'gpt-test',protocol:'openai-responses',endpoint:'https://api.openai.com/v1',supportsTools:true};
    let request;
    const client = create(model, async (url, init) => {
      request = {url, body:JSON.parse(init.body)};
      return jsonResponse({output_text:'Done',output:[
        {type:'reasoning',summary:[{text:'plan'}]},
        {type:'function_call',call_id:'fc-1',name:'lookup',arguments:'{"id":2}'}
      ]});
    });
    const result = await client.complete([{role:'user',content:'go'}]);
    assert.equal(request.url,'https://api.openai.com/v1/responses');
    assert.equal(request.body.reasoning.summary,'auto');
    assert.equal(request.body.input[0].content[0].text,'go');
    assert.equal(result.content,'Done');
    assert.equal(result.reasoning_content,'plan');
    assert.equal(result.tool_calls[0].id,'fc-1');
    assert.equal(result.tool_calls[0].function.name,'lookup');
  });

  await test('Anthropic Messages request format and tool-use normalization', async () => {
    const model = {id:'anthropic',model:'claude-test',protocol:'anthropic-messages',endpoint:'https://api.anthropic.com',supportsTools:true};
    let request;
    const client = create(model, async (url, init) => {
      request = {url, init, body:JSON.parse(init.body)};
      return jsonResponse({content:[
        {type:'text',text:'Answer'},
        {type:'tool_use',id:'tool-1',name:'lookup',input:{id:3}}
      ],usage:{input_tokens:2,output_tokens:5}});
    });
    const result = await client.complete([{role:'system',content:'Be brief'},{role:'user',content:'find'}], {
      tools:[{type:'function',function:{name:'lookup',description:'Lookup',parameters:{type:'object',properties:{id:{type:'number'}}}}}]
    });
    assert.equal(request.url,'https://api.anthropic.com/v1/messages');
    assert.equal(request.init.headers['x-api-key'],'test-token');
    assert.equal(request.init.headers['anthropic-version'],'2023-06-01');
    assert.equal(request.body.system,'Be brief');
    assert.equal(request.body.tools[0].input_schema.type,'object');
    assert.equal(result.content,'Answer');
    assert.equal(result.tool_calls[0].function.arguments,'{"id":3}');
  });

  await test('Gemini generateContent URL, key header and function-call normalization', async () => {
    const model = {id:'gemini',model:'gemini-test',protocol:'google-gemini',endpoint:'https://generativelanguage.googleapis.com',supportsTools:true};
    let request;
    const client = create(model, async (url, init) => {
      request = {url, init, body:JSON.parse(init.body)};
      return jsonResponse({candidates:[{content:{parts:[
        {text:'Gemini says hi'},
        {functionCall:{id:'fn-1',name:'lookup',args:{term:'x'}}}
      ]}}]});
    });
    const result = await client.complete([{role:'system',content:'Rules'},{role:'user',content:'Hello'}], {
      tools:[{type:'function',function:{name:'lookup',parameters:{type:'object',properties:{term:{type:'string'}}}}}]
    });
    assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.equal(request.init.headers['x-goog-api-key'],'test-token');
    assert.equal(request.body.systemInstruction.parts[0].text,'Rules');
    assert.equal(request.body.tools[0].functionDeclarations[0].name,'lookup');
    assert.equal(result.content,'Gemini says hi');
    assert.equal(result.tool_calls[0]._geminiCallId,'fn-1');
    assert.equal(result.tool_calls[0].function.arguments,'{"term":"x"}');
  });

  await test('Cohere v2 Chat request and tool-call normalization', async () => {
    const model = {id:'cohere',model:'command-test',protocol:'cohere-v2',endpoint:'https://api.cohere.com',supportsTools:true};
    let request;
    const client = create(model, async (url, init) => {
      request = {url, init, body:JSON.parse(init.body)};
      return jsonResponse({message:{content:[{type:'text',text:'Cohere answer'}],tool_calls:[
        {id:'co-1',function:{name:'lookup',arguments:'{"term":"a"}'}}
      ]}});
    });
    const result = await client.complete([{role:'user',content:'Hello'}]);
    assert.equal(request.url,'https://api.cohere.com/v2/chat');
    assert.equal(request.init.headers.Authorization,'Bearer test-token');
    assert.equal(request.body.messages[0].role,'user');
    assert.equal(result.content,'Cohere answer');
    assert.equal(result.tool_calls[0].function.name,'lookup');
  });

  await test('Gradio Space queue flow and streamed text normalization', async () => {
    const model = {id:'gradio',model:'space-model',remoteModel:'space-model',protocol:'gradio-space',endpoint:'https://example.hf.space'};
    const urls = [];
    const client = create(model, async (url, init) => {
      urls.push({url,method:init.method||'GET'});
      if (url.endsWith('/gradio/gradio_api/call/chat')) return new Response('',{status:404});
      if (url.endsWith('/gradio_api/call/chat')) return jsonResponse({event_id:'event-1'});
      if (url.endsWith('/gradio_api/call/chat/event-1')) {
        return new Response('event: complete\ndata: ["Gradio answer"]\n\n',{headers:{'content-type':'text/event-stream'}});
      }
      throw new Error('Unexpected Gradio URL: '+url);
    });
    const result = await client.complete([{role:'user',content:'hello'}]);
    assert.equal(urls.length,3);
    assert.equal(urls[1].url,'https://example.hf.space/gradio_api/call/chat');
    assert.equal(result.content,'Gradio answer');
  });

  await test('HTTP 429 and transport retries are separately injected and recorded', async () => {
    const model = {id:'retry',model:'retry-model',protocol:'openai-chat',endpoint:'https://retry.test/v1'};
    let calls=0, sleeps=0, analytics=[];
    const client = create(model, async () => {
      calls++;
      if (calls===1) return jsonResponse({error:{message:'busy'}},429,{'retry-after':'0'});
      if (calls===2) throw new Error('temporary network failure');
      return jsonResponse({choices:[{message:{content:'recovered'}}]});
    }, {
      getPreferences:()=>({retry429:true,max429Retries:1,baseRetryDelay:250,retryTransport:true,maxTransportRetries:1,transportRetryDelay:250}),
      sleep:async()=>{sleeps++;},
      analytics:info=>analytics.push(info)
    });
    const result = await client.complete([{role:'user',content:'retry'}],{});
    assert.equal(result.content,'recovered');
    assert.equal(calls,3);
    assert.equal(sleeps,2);
    assert.equal(analytics.filter(x=>x.retries429).length,1);
    assert.equal(analytics.filter(x=>x.transportRetry).length,1);
  });

  await test('native SSE streaming emits cumulative text and supports cancellation', async () => {
    const model = {id:'stream',model:'stream-model',protocol:'openai-chat',endpoint:'https://stream.test/v1'};
    const client = create(model, async () => new Response(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
      'data: [DONE]\n\n',
      {headers:{'content-type':'text/event-stream'}}
    ));
    const chunks=[];
    for await (const chunk of client.stream([{role:'user',content:'hi'}])) chunks.push(chunk);
    assert.equal(chunks[0].text,'Hello');
    assert.equal(chunks[0].delta,'Hello');

    let signal;
    const waiting = create(model, (url, init) => new Promise((resolve,reject) => {
      signal=init.signal;
      signal.addEventListener('abort',()=>{const error=new Error('Aborted');error.name='AbortError';reject(error);},{once:true});
    }), {getPreferences:()=>({retryTransport:false})});
    const iterator=waiting.stream([{role:'user',content:'stop'}]);
    const pending=iterator.next();
    await new Promise(resolve=>setTimeout(resolve,0));
    waiting.cancel();
    await assert.rejects(pending,error=>error.name==='AbortError');
  });

  await test('Groq reasoning options and tool-call parse recovery remain provider-specific', async () => {
    const model = {id:'groq',provider:'groq',model:'openai/gpt-oss-120b',protocol:'openai-chat',endpoint:'https://api.groq.com/openai/v1'};
    const requests=[];
    const providers=registry(model,{
      groq:{
        chatOptions:[{match:/gpt-oss/i,body:{include_reasoning:true}}],
        toolCallRecovery:{status:400,errorCodes:['output_parse_failed'],strategy:'lower-temperature',maxRetries:2,factor:.5,minTemperature:.2}
      }
    });
    const client=create(model,async(url,init)=>{
      requests.push(JSON.parse(init.body));
      if(requests.length===1)return jsonResponse({error:{code:'output_parse_failed',message:'Unable to parse tool call'}},400);
      return jsonResponse({choices:[{message:{content:'ok'}}]});
    },{providers,getPreferences:()=>({toolRecovery:true,maxToolRecoveryRetries:1})});
    const result=await client.complete([{role:'user',content:'use tool'}],{temperature:.8});
    assert.equal(result.content,'ok');
    assert.equal(requests.length,2);
    assert.equal(requests[0].include_reasoning,true);
    assert.equal(requests[0].temperature,.8);
    assert.equal(requests[1].temperature,.4);
  });

  await test('local Transformers execution is delegated to the injected host executor', async () => {
    const model={id:'local',model:'local-test',protocol:'local-transformers',local:true,supportsTools:false};
    let called=false;
    const client=create(model,async()=>{throw new Error('remote transport should not be called');},{
      localExecutor:{
        complete:async()=>{called=true;return {role:'assistant',content:'local response',tool_calls:[],reasoning_content:''};},
        async *stream(){yield {text:'local response',delta:'local response',reasoning:''};}
      }
    });
    const result=await client.complete([{role:'user',content:'hi'}]);
    assert.equal(called,true);
    assert.equal(result.content,'local response');
  });

  await test('normalized provider tool calls remain compatible with the LocalAI agent contract', async () => {
    const model={id:'agent',model:'agent-model',protocol:'openai-chat',endpoint:'https://agent.test/v1',supportsTools:true};
    let call=0,executed=0;
    const client=create(model,async()=>{
      call++;
      if(call===1)return jsonResponse({choices:[{message:{content:'',tool_calls:[
        {id:'agent-call-1',type:'function',function:{name:'echo',arguments:'{"value":"ok"}'}}
      ]}}]});
      return jsonResponse({choices:[{message:{content:'Finished'}}]});
    });
    const runtime=LocalAI.createRuntime({
      client,
      maxSteps:4,
      tools:[{name:'echo',description:'Echo a value',parameters:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execute:async args=>{executed++;return args.value;}}]
    });
    const result=await runtime.run([{role:'user',content:'call echo'}]);
    assert.equal(executed,1);
    assert.equal(result.text,'Finished');
    runtime.dispose();
  });

  process.stdout.write('All provider-client tests passed.\n');
})().catch(error => {
  console.error(error);
  process.exitCode=1;
});
