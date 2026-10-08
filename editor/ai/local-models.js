(function(){
  const root=window.EditorAI=window.EditorAI||{};
  root.LOCAL_MODEL_PROTOCOL='local-transformers';
  root.LOCAL_MODEL_LIBRARY_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
  root.DEFAULT_LOCAL_MODEL_ID='local-qwen25-1.5b';
  root.LOCAL_MODELS=[
    {id:'local-qwen25-1.5b',name:'Qwen2.5 1.5B · Local',model:'onnx-community/Qwen2.5-1.5B-Instruct',protocol:'local-transformers',provider:'local',local:true,builtInLocal:true,public:true,requiresKey:false,supportsTools:false,supportsAgentTools:true,supportsReasoning:false,supportsStreaming:true},
    {id:'local-qwen25-0.5b',name:'Qwen2.5 0.5B · Local',model:'onnx-community/Qwen2.5-0.5B-Instruct',protocol:'local-transformers',provider:'local',local:true,builtInLocal:true,public:true,requiresKey:false,supportsTools:false,supportsAgentTools:true,supportsReasoning:false,supportsStreaming:true}
  ];
})();