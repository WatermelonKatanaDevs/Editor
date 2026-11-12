(function() {
  const root = window.EditorAI = window.EditorAI || {};
  const runtime = window.LocalAI;
  if (!runtime?.Agent || !runtime?.ToolRegistry) throw new Error('The standalone LocalAI runtime must load before EditorAI agent integration.');
  root.AIAgent = runtime.Agent;
  root.ToolRegistry = runtime.ToolRegistry;
  root.Runtime = runtime.Runtime;
  root.createRuntime = runtime.createRuntime;
})();
