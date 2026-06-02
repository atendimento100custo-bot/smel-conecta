// Coordenadas aproximadas dos bairros de Volta Redonda, RJ
// Usadas para marcar os polos no mapa
export const COORDS_BAIRRO = {
  'Jardim Paraíba':        [-22.5249, -44.0751],
  'Voldac':                [-22.5107, -44.0879],
  'Aterrado':              [-22.5189, -44.0992],
  'Santo Agostinho':       [-22.5245, -44.0968],
  'Jardim Amália':         [-22.5467, -44.0883],
  'São Geraldo':           [-22.5331, -44.0851],
  'Retiro':                [-22.5454, -44.1135],
  'Vila Rica (Jd. Tiradentes)': [-22.5351, -44.1351],
  'Ilha São João':         [-22.5167, -44.0948],
  'Vila Rica (Três Poços)':[-22.5291, -44.1245],
  'Santa Cruz':            [-22.5181, -44.0638],
  'Açude I':               [-22.5013, -44.0986],
  'Siderlândia':           [-22.5029, -44.0921],
  'Belvedere':             [-22.5389, -44.0762],
  'Água Limpa':            [-22.5568, -44.1019],
  'Brasilândia':           [-22.5472, -44.0714],
  'Caieiras':              [-22.4989, -44.1102],
  'Candelária':            [-22.5129, -44.1093],
  'Eucaliptal':            [-22.5235, -44.1187],
  'Jardim Belmonte':       [-22.5395, -44.0892],
  'Jardim Ponte Alta':     [-22.5518, -44.0891],
  'Monte Castelo':         [-22.5167, -44.1054],
  'Rústico':               [-22.5301, -44.1187],
  'Santa Rita do Zarur':   [-22.4902, -44.0869],
  'São Cristóvão':         [-22.5359, -44.0668],
  'São Luis':              [-22.5501, -44.0742],
  'Sessenta':              [-22.5489, -44.0578],
  'Siderópolis':           [-22.5089, -44.1198],
  '3 Poços':               [-22.5291, -44.1389],
  'Vila Americana':        [-22.5429, -44.0851],
  'Vila Brasília':         [-22.5279, -44.0699],
  'Vila Mury':             [-22.5251, -44.1126],
  '249':                   [-22.5179, -44.1259],
  'Três Poços':            [-22.5291, -44.1389],
}

// Centro de Volta Redonda
export const VR_CENTER = [-22.523, -44.099]

// Retorna coordenadas do bairro ou centro da cidade se não encontrado
export function getCoordsForBairro(bairro) {
  if (!bairro) return VR_CENTER
  // Busca exata primeiro
  if (COORDS_BAIRRO[bairro]) return COORDS_BAIRRO[bairro]
  // Busca parcial (ex: "Vila Rica" encontra "Vila Rica (Jd. Tiradentes)")
  const key = Object.keys(COORDS_BAIRRO).find(k =>
    k.toLowerCase().includes(bairro.toLowerCase()) ||
    bairro.toLowerCase().includes(k.toLowerCase())
  )
  return key ? COORDS_BAIRRO[key] : VR_CENTER
}
