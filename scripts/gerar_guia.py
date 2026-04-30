"""
Gera o Guia do Usuário — SMEL Conecta
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable

# ── Cores SMEL ────────────────────────────────────────────────────────────────
VERDE       = HexColor('#009640')
VERDE_DARK  = HexColor('#00752f')
VERDE_LIGHT = HexColor('#e6f4ec')
NAVY        = HexColor('#0f172a')
SLATE       = HexColor('#475569')
SLATE_LIGHT = HexColor('#94a3b8')
AMBER       = HexColor('#f59e0b')
AMBER_LIGHT = HexColor('#fffbeb')
BG_LIGHT    = HexColor('#f8fafc')
BORDER      = HexColor('#e2e8f0')
RED         = HexColor('#ef4444')
RED_LIGHT   = HexColor('#fef2f2')

W, H = A4


class ColorRect(Flowable):
    """Retângulo colorido de fundo."""
    def __init__(self, width, height, color, radius=6):
        Flowable.__init__(self)
        self.width  = width
        self.height = height
        self.color  = color
        self.radius = radius

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.roundRect(0, 0, self.width, self.height, self.radius, fill=1, stroke=0)


def build_styles():
    base = getSampleStyleSheet()

    def S(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        'cover_title': S('cover_title',
            fontName='Helvetica-Bold', fontSize=28, textColor=white,
            alignment=TA_CENTER, spaceAfter=8, leading=34),

        'cover_sub': S('cover_sub',
            fontName='Helvetica', fontSize=13, textColor=HexColor('#d1fae5'),
            alignment=TA_CENTER, spaceAfter=6, leading=18),

        'cover_version': S('cover_version',
            fontName='Helvetica', fontSize=10, textColor=HexColor('#86efac'),
            alignment=TA_CENTER),

        'h1': S('h1',
            fontName='Helvetica-Bold', fontSize=16, textColor=NAVY,
            spaceBefore=22, spaceAfter=8, leading=20,
            borderPadding=(0, 0, 4, 0)),

        'h2': S('h2',
            fontName='Helvetica-Bold', fontSize=12, textColor=VERDE_DARK,
            spaceBefore=14, spaceAfter=5, leading=16),

        'h3': S('h3',
            fontName='Helvetica-Bold', fontSize=10, textColor=NAVY,
            spaceBefore=8, spaceAfter=3, leading=14),

        'body': S('body',
            fontName='Helvetica', fontSize=10, textColor=SLATE,
            spaceAfter=6, leading=15, alignment=TA_JUSTIFY),

        'body_bold': S('body_bold',
            fontName='Helvetica-Bold', fontSize=10, textColor=NAVY,
            spaceAfter=4, leading=15),

        'bullet': S('bullet',
            fontName='Helvetica', fontSize=10, textColor=SLATE,
            spaceAfter=4, leading=15, leftIndent=14,
            bulletIndent=0),

        'tip_text': S('tip_text',
            fontName='Helvetica', fontSize=9.5, textColor=HexColor('#065f46'),
            spaceAfter=2, leading=14),

        'warn_text': S('warn_text',
            fontName='Helvetica', fontSize=9.5, textColor=HexColor('#92400e'),
            spaceAfter=2, leading=14),

        'info_text': S('info_text',
            fontName='Helvetica', fontSize=9.5, textColor=HexColor('#1e40af'),
            spaceAfter=2, leading=14),

        'code': S('code',
            fontName='Courier', fontSize=9, textColor=NAVY,
            backColor=BG_LIGHT, spaceAfter=6, leading=13,
            leftIndent=8, rightIndent=8,
            borderPadding=(6, 6, 6, 6)),

        'caption': S('caption',
            fontName='Helvetica', fontSize=8, textColor=SLATE_LIGHT,
            alignment=TA_CENTER, spaceAfter=4),

        'toc_item': S('toc_item',
            fontName='Helvetica', fontSize=10, textColor=SLATE,
            spaceAfter=5, leading=14, leftIndent=0),

        'toc_section': S('toc_section',
            fontName='Helvetica-Bold', fontSize=11, textColor=NAVY,
            spaceAfter=6, leading=16),

        'footer': S('footer',
            fontName='Helvetica', fontSize=8, textColor=SLATE_LIGHT,
            alignment=TA_CENTER),

        'table_header': S('table_header',
            fontName='Helvetica-Bold', fontSize=9, textColor=white,
            alignment=TA_CENTER, leading=12),

        'table_cell': S('table_cell',
            fontName='Helvetica', fontSize=9, textColor=SLATE,
            leading=13, alignment=TA_LEFT),

        'table_cell_bold': S('table_cell_bold',
            fontName='Helvetica-Bold', fontSize=9, textColor=NAVY,
            leading=13, alignment=TA_LEFT),
    }


def tip_box(text, S, kind='tip'):
    """Caixa colorida de dica / aviso / informação."""
    if kind == 'tip':
        bg, icon, style = VERDE_LIGHT, '✅', S['tip_text']
    elif kind == 'warn':
        bg, icon, style = AMBER_LIGHT, '⚠️', S['warn_text']
    else:
        bg, icon, style = HexColor('#eff6ff'), 'ℹ️', S['info_text']

    content = Paragraph(f'{icon}  {text}', style)
    t = Table([[content]], colWidths=[14.5 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('ROUNDEDCORNERS', [6]),
        ('BOX',     (0, 0), (-1, -1), 0.5, HexColor('#d1fae5') if kind == 'tip' else (AMBER if kind == 'warn' else HexColor('#bfdbfe'))),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    return t


def section_divider(S):
    return [
        Spacer(1, 4),
        HRFlowable(width='100%', thickness=1, color=BORDER),
        Spacer(1, 4),
    ]


def step_table(steps, S):
    """Tabela numerada de passos."""
    rows = []
    for i, (titulo, desc) in enumerate(steps, 1):
        num  = Paragraph(f'<b>{i}</b>', ParagraphStyle('n', fontName='Helvetica-Bold',
                fontSize=11, textColor=VERDE, alignment=TA_CENTER, leading=14))
        cell = [Paragraph(titulo, S['body_bold']), Paragraph(desc, S['body'])]
        rows.append([num, cell])

    t = Table(rows, colWidths=[1.2 * cm, 13.3 * cm])
    t.setStyle(TableStyle([
        ('VALIGN',     (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (0, -1), VERDE_LIGHT),
        ('ALIGN',      (0, 0), (0, -1), 'CENTER'),
        ('ROUNDEDCORNERS', [4]),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [white, BG_LIGHT]),
        ('GRID',          (0, 0), (-1, -1), 0.3, BORDER),
    ]))
    return t


def cargo_table(S):
    headers = [
        Paragraph('Cargo', S['table_header']),
        Paragraph('O que pode fazer', S['table_header']),
        Paragraph('Restrições', S['table_header']),
    ]
    rows = [headers]
    data = [
        ('Administrador', 'Acesso total: criar/editar tudo, gerenciar usuarios, ver todos os polos', 'Nenhuma'),
        ('Coordenador',   'Ver e editar dados de polos vinculados, criar turmas e alunos',         'Nao pode criar outros admins'),
        ('Professor',     'Registrar presenca, ver alunos e turmas proprias, registrar aulas',      'Nao edita dados de outros professores'),
        ('Estagiario',    'Registrar presenca nas turmas vinculadas, ver alunos',                   'Nao cria nem edita cadastros'),
    ]
    for cargo, pode, restricao in data:
        rows.append([
            Paragraph(f'<b>{cargo}</b>', S['table_cell_bold']),
            Paragraph(pode, S['table_cell']),
            Paragraph(restricao, S['table_cell']),
        ])

    t = Table(rows, colWidths=[3.2 * cm, 7 * cm, 4.3 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), VERDE),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [white, BG_LIGHT]),
        ('GRID',          (0, 0), (-1, -1), 0.3, BORDER),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 7),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 7),
        ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
    ]))
    return t


def csv_table(S):
    headers = [Paragraph(h, S['table_header']) for h in
               ['Coluna', 'Descricao', 'Exemplo', 'Obrigatorio']]
    data = [
        ('nome',      'Nome completo do aluno',          'Maria Silva',   'Sim'),
        ('data_nasc', 'Data de nascimento (AAAA-MM-DD)', '1985-03-22',    'Nao'),
        ('cpf',       'CPF (somente numeros ou formato)', '123.456.789-00','Nao'),
        ('telefone',  'Telefone com DDD',                '(24) 99999-0000','Nao'),
        ('turma_id',  'ID da turma (ver aba Turmas)',     'uuid da turma', 'Nao'),
    ]
    rows = [headers]
    for col, desc, ex, obrig in data:
        rows.append([
            Paragraph(f'<b>{col}</b>', ParagraphStyle('c', fontName='Courier-Bold',
                fontSize=8.5, textColor=VERDE_DARK, leading=12)),
            Paragraph(desc, S['table_cell']),
            Paragraph(ex,   ParagraphStyle('e', fontName='Courier', fontSize=8,
                textColor=SLATE, leading=12)),
            Paragraph(obrig, S['table_cell']),
        ])

    t = Table(rows, colWidths=[2.5 * cm, 5.5 * cm, 4.5 * cm, 2 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [white, BG_LIGHT]),
        ('GRID',          (0, 0), (-1, -1), 0.3, BORDER),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 7),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 7),
    ]))
    return t


# ── Cabeçalho e rodapé de página ─────────────────────────────────────────────
def on_first_page(canvas, doc):
    pass

def on_later_pages(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(SLATE_LIGHT)
    canvas.drawString(2 * cm, 1.2 * cm, 'SMEL Conecta — Guia do Usuario')
    canvas.drawRightString(W - 2 * cm, 1.2 * cm, f'Pagina {doc.page}')
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, 1.6 * cm, W - 2 * cm, 1.6 * cm)
    canvas.restoreState()


# ── Montar documento ──────────────────────────────────────────────────────────
def build_guide(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2.5 * cm,
    )
    S = build_styles()
    story = []
    full_w = 14.5 * cm   # largura útil

    # ══════════════════════════════════════════════════════════════════════════
    # CAPA
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 1.5 * cm))

    # Faixa verde de capa
    cover_bg = Table(
        [[Paragraph('SMEL Conecta', S['cover_title'])],
         [Paragraph('Secretaria Municipal de Esporte e Lazer', S['cover_sub'])],
         [Paragraph('Prefeitura de Volta Redonda', S['cover_sub'])],
         [Spacer(1, 0.3 * cm)],
         [Paragraph('Guia do Usuario', ParagraphStyle('gu',
             fontName='Helvetica-Bold', fontSize=18, textColor=HexColor('#d1fae5'),
             alignment=TA_CENTER, leading=22))],
         [Paragraph('Sistema de Gestao de Polos Esportivos', S['cover_version'])],
        ],
        colWidths=[full_w]
    )
    cover_bg.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), VERDE),
        ('ROUNDEDCORNERS',[10]),
        ('TOPPADDING',    (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ('LEFTPADDING',   (0, 0), (-1, -1), 20),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 20),
    ]))
    story.append(cover_bg)
    story.append(Spacer(1, 0.8 * cm))

    # Info cards na capa
    info_data = [
        ['🔗 Acesso', 'smel-conecta.vercel.app'],
        ['📱 Compativel', 'Celular, tablet e computador'],
        ['🔒 Login',  'Email + senha fornecidos pelo administrador'],
    ]
    for label, val in info_data:
        row = Table([[Paragraph(f'<b>{label}:</b>  {val}', S['body'])]], colWidths=[full_w])
        row.setStyle(TableStyle([
            ('BACKGROUND', (0,0),(-1,-1), BG_LIGHT),
            ('BOX',        (0,0),(-1,-1), 0.5, BORDER),
            ('PADDING',    (0,0),(-1,-1), 8),
            ('ROUNDEDCORNERS', [4]),
        ]))
        story.append(row)
        story.append(Spacer(1, 0.15 * cm))

    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph('Abril 2025 — Versao 1.0', S['caption']))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SUMARIO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('Sumario', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.3 * cm))

    toc = [
        ('1.', 'O que e o SMEL Conecta?'),
        ('2.', 'Como fazer login e trocar a senha'),
        ('3.', 'Tela principal — Dashboard'),
        ('4.', 'Polos'),
        ('5.', 'Alunos — Cadastro, busca e importacao'),
        ('6.', 'Turmas'),
        ('7.', 'Presenca — Como registrar'),
        ('8.', 'Equipe — Adicionar funcionarios'),
        ('9.', 'Viagens — Melhor Idade'),
        ('10.', 'Gerenciar Acesso (somente Admin)'),
        ('11.', 'Perguntas Frequentes'),
    ]
    for num, title in toc:
        story.append(Paragraph(f'<b>{num}</b>  {title}', S['toc_item']))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 1. O QUE É O SMEL CONECTA
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('1. O que e o SMEL Conecta?', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'O <b>SMEL Conecta</b> e o sistema de gestao dos polos esportivos da '
        'Secretaria Municipal de Esporte e Lazer de Volta Redonda. '
        'Ele permite controlar alunos, turmas, presencas, viagens da '
        'Melhor Idade e a equipe de professores, tudo em um so lugar, '
        'acessivel pelo celular ou pelo computador.',
        S['body']))

    story.append(Paragraph('Principais recursos:', S['h2']))
    recursos = [
        ('📍 Polos', 'Gerencia todos os polos da SMEL com suas turmas, alunos e metricas de presenca.'),
        ('🎓 Alunos', 'Cadastro completo com foto, CPF, telefone de emergencia, turmas e controle de elegibilidade para viagens.'),
        ('📋 Turmas', 'Cada turma tem modalidade, dias, horario, professor responsavel e faixa etaria.'),
        ('✅ Presenca', 'O professor ou estagiario marca presenca aula por aula. Todos comecam como ausentes.'),
        ('🚌 Viagens', 'Gerencia viagens exclusivas da Melhor Idade com lista de elegibilidade automatica.'),
        ('👥 Equipe', 'Perfis de todos os funcionarios com cargos e vinculos a polos/turmas.'),
        ('📊 Dashboard', 'Painel de indicadores em tempo real: alunos ativos, frequencia media, ocupacao dos polos.'),
    ]
    for icone_nome, desc in recursos:
        row = Table([[Paragraph(icone_nome, S['body_bold']), Paragraph(desc, S['body'])]],
                    colWidths=[3.5 * cm, 11 * cm])
        row.setStyle(TableStyle([
            ('VALIGN',  (0,0),(-1,-1), 'TOP'),
            ('TOPPADDING',    (0,0),(-1,-1), 5),
            ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ]))
        story.append(row)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 2. LOGIN
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('2. Como fazer login e trocar a senha', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph('Primeiro acesso:', S['h2']))
    story.append(step_table([
        ('Abra o navegador',
         'No celular ou computador, acesse: <b>smel-conecta.vercel.app</b>'),
        ('Digite seu e-mail',
         'Use o e-mail cadastrado pelo administrador do sistema.'),
        ('Digite sua senha',
         'Use a senha temporaria fornecida pelo administrador.'),
        ('Clique em "Entrar"',
         'Voce sera redirecionado para o Dashboard principal.'),
    ], S))

    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'Recomendamos trocar a senha apos o primeiro acesso. '
        'Va em Configuracoes (icone de engrenagem no menu) → Alterar Senha.',
        S, kind='tip'))

    story.append(Paragraph('Senhas iniciais dos funcionarios cadastrados:', S['h2']))
    senha_data = [
        [Paragraph('Nome', S['table_header']), Paragraph('E-mail', S['table_header']),
         Paragraph('Senha Inicial', S['table_header'])],
        [Paragraph('Daniel Alves',    S['table_cell']), Paragraph('professordaniel_93@hotmail.com', S['table_cell']), Paragraph('Smel@2025!Da', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
        [Paragraph('Rafael Alvarenga',S['table_cell']), Paragraph('aalvarenga.rafael@gmail.com',    S['table_cell']), Paragraph('Smel@2025!Ra', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
        [Paragraph('Raul Victorino',  S['table_cell']), Paragraph('raulvictorino1967@gmail.com',    S['table_cell']), Paragraph('Smel@2025!Rv', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
        [Paragraph('Rose Vilela',     S['table_cell']), Paragraph('rosemvilela@yahoo.com.br',       S['table_cell']), Paragraph('Smel@2025!Ro', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
        [Paragraph('Vivian Bastos',   S['table_cell']), Paragraph('vivibastosmonteiro@outlook.com', S['table_cell']), Paragraph('Smel@2025!Vb', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
        [Paragraph('Viviane Souza',   S['table_cell']), Paragraph('viviane.pss01@gmail.com',        S['table_cell']), Paragraph('Smel@2025!Vs', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
        [Paragraph('Silvio',          S['table_cell']), Paragraph('silvio.vilela@foa.org.br',       S['table_cell']), Paragraph('Smel@2025!Si', ParagraphStyle('pw', fontName='Courier-Bold', fontSize=9, textColor=VERDE_DARK, leading=13))],
    ]
    t = Table(senha_data, colWidths=[3.5 * cm, 6.5 * cm, 4.5 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,0), NAVY),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [white, BG_LIGHT]),
        ('GRID',          (0,0),(-1,-1), 0.3, BORDER),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0),(-1,-1), 6),
        ('BOTTOMPADDING', (0,0),(-1,-1), 6),
        ('LEFTPADDING',   (0,0),(-1,-1), 7),
        ('RIGHTPADDING',  (0,0),(-1,-1), 7),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'Troque sua senha imediatamente apos o primeiro acesso para garantir a seguranca da sua conta.',
        S, kind='warn'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 3. DASHBOARD
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('3. Tela principal — Dashboard', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'O Dashboard e a primeira tela apos o login. Ele mostra um resumo '
        'geral de toda a SMEL em tempo real.',
        S['body']))

    story.append(Paragraph('Indicadores exibidos:', S['h2']))
    indicadores = [
        ('Alunos Ativos',      'Total de alunos com status "Ativo" em todas as turmas.'),
        ('Turmas Ativas',      'Numero de turmas em funcionamento.'),
        ('Polos Ativos',       'Quantidade de polos da SMEL em atividade.'),
        ('Freq. Media',        'Percentual medio de presenca de todos os alunos.'),
        ('Melhor Idade',       'Alunos com 60 anos ou mais.'),
        ('Novos (30 dias)',     'Alunos matriculados nos ultimos 30 dias.'),
        ('Ocupacao',           'Percentual de vagas preenchidas em relacao a capacidade total.'),
        ('Atestados Vencidos', 'Alunos com atestado medico expirado — requer atencao.'),
    ]
    rows = [[Paragraph(nome, S['body_bold']), Paragraph(desc, S['body'])]
            for nome, desc in indicadores]
    t = Table(rows, colWidths=[3.8 * cm, 10.7 * cm])
    t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [white, BG_LIGHT]),
        ('GRID',           (0,0),(-1,-1), 0.3, BORDER),
        ('VALIGN',         (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',     (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',  (0,0),(-1,-1), 6),
        ('LEFTPADDING',    (0,0),(-1,-1), 7),
        ('RIGHTPADDING',   (0,0),(-1,-1), 7),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'Os graficos de presenca dos ultimos 7 dias ajudam a identificar dias '
        'com baixa frequencia e tomar acoes corretivas rapidamente.',
        S, kind='info'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 4. POLOS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('4. Polos', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'Cada polo e uma unidade fisica da SMEL (quadra, ginasio, parque etc.). '
        'Dentro de cada polo existem turmas, alunos e professores.',
        S['body']))

    story.append(Paragraph('Abas dentro de um polo:', S['h2']))
    abas = [
        ('Visao Geral',  'KPIs do polo, grafico de presenca dos ultimos 7 dias, lista de turmas e equipe local.'),
        ('Operacional',  'Turmas que acontecem HOJE. Clique em uma turma para abrir o registro de aula e a lista de presenca.'),
        ('Viagens',      'Exclusivo para turmas de Melhor Idade. Mostra viagens cadastradas e o ranking de elegibilidade dos alunos.'),
    ]
    for nome, desc in abas:
        story.append(Paragraph(f'<b>{nome}</b>', S['body_bold']))
        story.append(Paragraph(desc, S['body']))

    story.append(Paragraph('Como adicionar uma nova turma ao polo:', S['h2']))
    story.append(step_table([
        ('Abra o polo desejado', 'Clique no polo na lista de Polos.'),
        ('Va para Visao Geral', 'Localize a secao "Modalidades e Turmas".'),
        ('Clique em "+ Nova Turma"', 'Preencha modalidade, dias, horario, faixa etaria, capacidade e professor responsavel.'),
        ('Salve', 'A turma aparece imediatamente na lista do polo.'),
    ], S))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph('Como adicionar um aluno diretamente do polo:', S['h2']))
    story.append(step_table([
        ('Abra o polo',          'Clique no polo na lista de Polos.'),
        ('Clique em "Novo Aluno"', 'Botao verde no cabecalho do polo.'),
        ('Preencha os dados',    'Nome, data de nascimento, CPF, telefone, telefone de emergencia, e-mail e selecione a turma dentro deste polo.'),
        ('Salve',                'O aluno e cadastrado e vinculado automaticamente ao polo e a turma escolhidos.'),
    ], S))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 5. ALUNOS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('5. Alunos — Cadastro, busca e importacao', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph('Cadastrar um aluno manualmente:', S['h2']))
    story.append(step_table([
        ('Acesse "Alunos" no menu', 'Clique em "Alunos" na barra lateral.'),
        ('Clique em "Novo Aluno"', 'Botao verde no canto superior direito.'),
        ('Preencha o formulario', 'Nome (obrigatorio), data de nascimento, CPF, telefone, '
         '<b>telefone de emergencia</b>, e-mail, status e endereco.'),
        ('Selecione as matriculas', 'Escolha o <b>polo</b> primeiro — as turmas daquele polo '
         'aparecem automaticamente. Clique em "+ Adicionar" para matricular o aluno em mais de uma turma.'),
        ('Salve', 'O aluno aparece na lista e nos polos/turmas selecionados.'),
    ], S))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph('Filtros de busca disponíveis:', S['h2']))
    filtros = [
        ('Pesquisa por nome', 'Campo de busca no topo da lista.'),
        ('Faixa etaria',      'Infantil (ate 17 anos), Adulto (18-59), Melhor Idade (60+).'),
        ('Modalidade',        'Filtra alunos pela modalidade da turma.'),
        ('Polo',              'Filtra alunos por polo de origem.'),
    ]
    for f, d in filtros:
        story.append(Paragraph(f'<b>• {f}:</b> {d}', S['bullet']))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph('Badge de elegibilidade para viagens:', S['h2']))
    story.append(Paragraph(
        'Alunos da Melhor Idade (60+) recebem automaticamente um badge colorido na lista:',
        S['body']))
    badges = [
        ('Verde — "Elegivel viagem"',   'Atestado valido E frequencia >= 70%.'),
        ('Amarelo — "Pendente viagem"', 'Falta atestado valido OU frequencia abaixo de 70%.'),
    ]
    for badge, cond in badges:
        story.append(Paragraph(f'<b>• {badge}:</b> {cond}', S['bullet']))

    story.append(Spacer(1, 0.5 * cm))

    # CSV
    story.append(Paragraph('Importacao em massa via CSV:', S['h2']))
    story.append(Paragraph(
        'Para cadastrar muitos alunos de uma vez, use o botao <b>"Importar CSV"</b>. '
        'O arquivo deve ser um .csv com a primeira linha contendo os cabecalhos abaixo:',
        S['body']))
    story.append(Spacer(1, 0.2 * cm))
    story.append(csv_table(S))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph('Exemplo de arquivo CSV:', S['h3']))
    story.append(Paragraph(
        'nome,data_nasc,cpf,telefone,turma_id\n'
        'Maria Silva,1985-03-22,123.456.789-00,(24) 99999-0000,\n'
        'Joao Pereira,1962-11-05,,,\n'
        'Ana Costa,2005-07-18,,,(24) 98888-1111,',
        ParagraphStyle('csv_ex', fontName='Courier', fontSize=8.5, textColor=NAVY,
            backColor=BG_LIGHT, leading=14, leftIndent=8, spaceAfter=6,
            borderPadding=(6,6,6,6))))
    story.append(tip_box(
        'Colunas em branco sao aceitas — o sistema ignora campos vazios. '
        'O campo "nome" e o unico obrigatorio.',
        S, kind='tip'))
    story.append(tip_box(
        'Antes de confirmar a importacao, o sistema exibe uma previa dos dados. '
        'Revise antes de clicar em "Importar".',
        S, kind='info'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 6. TURMAS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('6. Turmas', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'A aba <b>Turmas</b> lista todas as turmas da SMEL. '
        'Cada turma pertence a um polo e a uma modalidade.',
        S['body']))

    campos = [
        ('Modalidade',    'Qual esporte ou atividade (ex.: Futebol, Yoga, Natacao).'),
        ('Polo',          'Local onde a turma acontece.'),
        ('Dias',          'Dias da semana em que a turma ocorre.'),
        ('Horario',       'Hora de inicio da aula.'),
        ('Faixa etaria',  'Infantil, Adulto ou Melhor Idade.'),
        ('Capacidade',    'Numero maximo de alunos.'),
        ('Professor',     'Responsavel pela turma.'),
        ('Status',        'Ativa ou Inativa.'),
    ]
    rows = [[Paragraph(f, S['table_cell_bold']), Paragraph(d, S['table_cell'])]
            for f, d in campos]
    t = Table(rows, colWidths=[3 * cm, 11.5 * cm])
    t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [white, BG_LIGHT]),
        ('GRID',           (0,0),(-1,-1), 0.3, BORDER),
        ('VALIGN',         (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',     (0,0),(-1,-1), 6),
        ('BOTTOMPADDING',  (0,0),(-1,-1), 6),
        ('LEFTPADDING',    (0,0),(-1,-1), 7),
        ('RIGHTPADDING',   (0,0),(-1,-1), 7),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'Ao clicar em uma turma na lista de Alunos (filtrando por turma), '
        'voce ve o ranking de frequencia dos alunos daquela turma com barras coloridas.',
        S, kind='info'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 7. PRESENÇA
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('7. Presenca — Como registrar', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'O registro de presenca e feito <b>diariamente</b>, aula por aula. '
        'Por padrao, todos os alunos aparecem como <b>ausentes</b>. '
        'O professor ou estagiario marca somente quem esteve presente.',
        S['body']))

    story.append(Paragraph('Passo a passo:', S['h2']))
    story.append(step_table([
        ('Acesse o polo',         'Va em Polos → clique no polo correspondente.'),
        ('Aba Operacional',       'Clique na aba "Operacional". As turmas de HOJE aparecem listadas.'),
        ('Selecione a turma',     'Clique no card da turma. Um painel de registro abre na tela.'),
        ('Marque os presentes',   'Cada aluno aparece com um botao. Clique para alternar entre '
         '"Presente" (verde) e "Falta" (vermelho). Use "Todos" ou "Nenhum" para selecionar em massa.'),
        ('Registre o conteudo',   'Preencha o campo "Conteudo da Aula" com o que foi trabalhado.'),
        ('Registre ocorrencias',  'Se houver algo a relatar (lesao, conflito), anote no campo "Ocorrencias".'),
        ('Clique em "Salvar Aula"', 'Tudo e salvo de uma vez: presenca + registro da aula.'),
    ], S))

    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'O registro fica bloqueado 30 minutos apos o termino da aula (90 min apos o inicio). '
        'Registre a presenca durante ou logo apos a aula.',
        S, kind='warn'))
    story.append(Spacer(1, 0.2 * cm))
    story.append(tip_box(
        'A frequencia de cada aluno e calculada automaticamente com base nas presencas registradas. '
        'Alunos com frequencia abaixo de 70% nao sao elegiveis para viagens da Melhor Idade.',
        S, kind='info'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 8. EQUIPE
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('8. Equipe — Adicionar e gerenciar funcionarios', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'A aba <b>Equipe</b> exibe todos os funcionarios ativos da SMEL, '
        'organizados por polo e por cargo. Para adicionar um novo funcionario, '
        'use o botao <b>"Novo Funcionario"</b> que leva para a area de '
        '<b>Gerenciar Acesso</b>.',
        S['body']))

    story.append(Paragraph('Como adicionar um novo funcionario:', S['h2']))
    story.append(step_table([
        ('Acesse "Equipe" no menu',    'Clique em "Equipe" na barra lateral.'),
        ('Clique em "Novo Funcionario"','Botao verde no canto superior direito.'),
        ('Preencha os dados',          'Nome completo, e-mail, senha inicial, cargo e telefone.'),
        ('Escolha o cargo',            'Administrador, Coordenador, Professor ou Estagiario '
         '(veja tabela de permissoes abaixo).'),
        ('Clique em "Criar Usuario"',  'O funcionario recebe acesso imediato. '
         'Oriente-o a trocar a senha no primeiro acesso.'),
    ], S))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph('Niveis de acesso:', S['h2']))
    story.append(cargo_table(S))
    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'Coordenadores e estagiarios precisam ser vinculados a polos ou turmas '
        'apos a criacao. Clique no icone de link (corrente) na lista de Gerenciar Acesso.',
        S, kind='info'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 9. VIAGENS MELHOR IDADE
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('9. Viagens — Melhor Idade', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'As viagens sao exclusivas para alunos com <b>60 anos ou mais</b>. '
        'O sistema calcula automaticamente quem esta elegivel com base em tres criterios.',
        S['body']))

    story.append(Paragraph('Criterios de elegibilidade:', S['h2']))
    criterios = [
        ('Status Ativo',         'O aluno deve estar com status "Ativo" no sistema.'),
        ('Atestado Medico Valido','O atestado medico nao pode estar vencido.'),
        ('Frequencia >= 70%',    'O aluno precisa ter pelo menos 70% de presenca registrada.'),
    ]
    for c, d in criterios:
        story.append(Paragraph(f'<b>• {c}:</b> {d}', S['bullet']))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph('Como cadastrar uma viagem:', S['h2']))
    story.append(step_table([
        ('Abra o polo',             'Va em Polos → clique no polo desejado.'),
        ('Clique na aba "Viagens"', 'Visivel apenas para polos com turmas de Melhor Idade.'),
        ('Clique em "Nova Viagem"', 'Botao ao lado da turma de Melhor Idade desejada.'),
        ('Preencha destino e data', 'Informe o destino e a data prevista da viagem.'),
        ('Defina as vagas',         'Numero maximo de participantes.'),
        ('Salve',                   'A viagem aparece na lista e o ranking de elegibilidade fica disponivel.'),
    ], S))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph('Ranking de engajamento:', S['h2']))
    story.append(Paragraph(
        'Dentro da aba Viagens, abaixo de cada turma de Melhor Idade, '
        'ha um ranking de todos os alunos ordenado por frequencia. '
        'Isso permite identificar os alunos mais assíduos para priorizar '
        'em caso de lista de espera.',
        S['body']))
    story.append(tip_box(
        'Verde >= 70% | Amarelo >= 50% | Vermelho < 50%  — '
        'as cores das barras de frequencia seguem esse padrao em todo o sistema.',
        S, kind='info'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 10. GERENCIAR ACESSO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('10. Gerenciar Acesso (somente Administrador)', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        'A area <b>Gerenciar Acesso</b> e visivel somente para Administradores. '
        'Nela e possivel:',
        S['body']))

    acoes = [
        'Criar novos usuarios (nome, e-mail, senha, cargo)',
        'Alterar o cargo de um funcionario existente',
        'Desativar o acesso de um funcionario (sem apagar os dados)',
        'Vincular coordenadores a polos especificos',
        'Vincular estagiarios a turmas especificas',
    ]
    for a in acoes:
        story.append(Paragraph(f'• {a}', S['bullet']))

    story.append(Spacer(1, 0.3 * cm))
    story.append(tip_box(
        'Para desativar um funcionario, clique no icone de lixeira ao lado do nome. '
        'O usuario perdera acesso mas seus dados historicos serao preservados.',
        S, kind='warn'))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 11. FAQ
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('11. Perguntas Frequentes', S['h1']))
    story.append(HRFlowable(width='100%', thickness=2, color=VERDE))
    story.append(Spacer(1, 0.2 * cm))

    faqs = [
        ('Esqueci minha senha, o que fazer?',
         'Entre em contato com o administrador do sistema para que ele redefina sua senha em Gerenciar Acesso.'),
        ('Posso acessar pelo celular?',
         'Sim! O SMEL Conecta foi desenvolvido para funcionar em qualquer tamanho de tela. '
         'Abra o navegador do celular e acesse smel-conecta.vercel.app.'),
        ('Como cadastrar atestado medico de um aluno?',
         'Acesse o perfil do aluno (clique no nome dele na lista de Alunos) → '
         'aba "Atestados" → clique em "+ Atestado" e informe a data de validade.'),
        ('O registro de presenca ficou bloqueado, o que houve?',
         'O sistema bloqueia o registro 30 minutos apos o horario de termino da aula (90 min do inicio). '
         'Caso precise corrigir um registro, contate o administrador.'),
        ('Um aluno pode estar em mais de uma turma?',
         'Sim! No formulario de cadastro do aluno, voce pode adicionar quantas matriculas quiser '
         'em diferentes polos e turmas. Clique em "+ Adicionar" para acrescentar mais uma turma.'),
        ('Como alterar minha senha?',
         'Va em Configuracoes (icone de engrenagem no menu lateral) e use a opcao "Alterar Senha".'),
        ('Como exportar dados dos alunos?',
         'Atualmente o sistema nao possui exportacao direta. Para relatorios, '
         'use a aba Relatorios no menu lateral.'),
        ('O que significa "Melhor Idade" no sistema?',
         'E a categoria para alunos com 60 anos ou mais. Eles tem elegibilidade avaliada '
         'para participar de viagens organizadas pela SMEL.'),
    ]

    for pergunta, resposta in faqs:
        bloco = KeepTogether([
            Paragraph(f'<b>P: {pergunta}</b>', S['body_bold']),
            Paragraph(f'R: {resposta}', S['body']),
            Spacer(1, 0.2 * cm),
        ])
        story.append(bloco)

    story.append(Spacer(1, 0.5 * cm))

    # Rodape final
    final = Table([[Paragraph(
        'Em caso de duvidas tecnicas, entre em contato com o administrador do sistema.\n'
        '<b>SMEL Conecta</b> — Prefeitura de Volta Redonda — Versao 1.0 — Abril 2025',
        ParagraphStyle('fin', fontName='Helvetica', fontSize=9, textColor=SLATE,
            alignment=TA_CENTER, leading=14)
    )]], colWidths=[full_w])
    final.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), VERDE_LIGHT),
        ('ROUNDEDCORNERS', [6]),
        ('BOX', (0,0),(-1,-1), 0.5, HexColor('#d1fae5')),
        ('PADDING', (0,0),(-1,-1), 12),
    ]))
    story.append(final)

    # Build
    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
    print(f'PDF gerado: {output_path}')


if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(__file__), '..', 'docs', 'Guia_SMEL_Conecta.pdf')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    build_guide(os.path.abspath(out))
