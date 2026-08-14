// Configurações globais de reconhecimento facial — altere aqui para todas as telas
export const FACE_CONFIG = {
  // Detecção
  inputSize: 416,
  scoreThreshold: 0.6,

  // Tamanho mínimo do rosto (cadastro exige mais qualidade)
  minFaceWidthCadastro: 0.32,  // cadastro, olhando de frente — mais rigoroso
  minFaceWidthCadastroLateral: 0.20, // cadastro, virando o rosto — a detecção "estreita" naturalmente nesse ângulo
  minFaceWidthReconhecimento: 0.15, // bater ponto — mais tolerante

  // Centralização
  minCX: 0.25, maxCX: 0.75,
  minCY: 0.15, maxCY: 0.85,

  // Iluminação
  minBrilhoCadastro: 90,
  minBrilhoReconhecimento: 60,
  maxBrilho: 220,

  // Abertura dos olhos
  minAberturaCadastro: 0.24,
  minAberturaReconhecimento: 0.18,

  // Reconhecimento
  maxDistancia: 0.65,
  minDiferencaSegunda: 0.05,

  // Cooldown entre registros de ponto (ms)
  cooldown: 8000,

  // Contagem regressiva ao reconhecer (ms)
  contagemRegressiva: 3000,
}