#!/usr/bin/env python3
"""
Generate FULL Singapore university programs database for SEDA matcher tool.
Replaces the existing 79-entry PROGRAMS array with ~200+ entries.
"""

# ── Subject key references ──
# A-Level (SG): h2_math, h2_fm, h2_physics, h2_chemistry, h2_biology, h2_economics, h2_computing, h2_history, h2_geography, h2_literature, h2_chinese, h2_art, h2_theatre, h2_music, h2_management, h2_translation
# IAL: ial_math, ial_fm, ial_physics, ial_chemistry, ial_biology, ial_economics, ial_accounting, ial_business, ial_cs, ial_eng_lang, ial_eng_lit, ial_chinese, ial_history, ial_geography, ial_psychology, ial_sociology, ial_art
# IB: hl_math_aa, hl_math_ai, hl_physics, hl_chemistry, hl_biology, hl_economics, hl_business, hl_history, hl_geography, hl_english_a, hl_chinese_a, hl_cs, hl_psychology
# AP: ap_calc_bc, ap_calc_ab, ap_physics_c_mech, ap_physics_c_em, ap_chemistry, ap_biology, ap_cs_a, ap_macro, ap_micro, ap_stats, ap_english_lang, ap_us_history, ap_psychology
# WACE: wace_math_methods, wace_math_specialist, wace_physics, wace_chemistry, wace_biology, wace_economics, wace_accounting, wace_english, wace_history, wace_cs, wace_design
# Gaokao: gk_chinese, gk_math, gk_english, gk_physics, gk_chemistry, gk_biology, gk_history_gk, gk_geography_gk, gk_politics

# ── Template profiles for common program types ──
def make_req(profile, diff, grade_override=None):
    """Generate req dict based on profile type and difficulty."""
    profiles = {
        'cs': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_computing','h2_fm','h2_physics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_cs','ial_fm','ial_physics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_cs','hl_physics']},
            'ap': {'must': ['ap_calc_bc','ap_cs_a'], 'prefer': ['ap_physics_c_mech']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_cs','wace_math_specialist']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_physics']},
        },
        'computing': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_computing','h2_physics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_cs','ial_physics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_cs']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_cs_a','ap_stats']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_cs']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_physics']},
        },
        'data_science': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_fm','h2_computing','h2_physics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_fm','ial_cs','ial_physics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_cs','hl_physics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_stats','ap_cs_a']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_math_specialist']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_physics']},
        },
        'eng_mech': {
            'a-level': {'must': ['h2_math','h2_physics'], 'prefer': ['h2_chemistry','h2_fm']},
            'ial': {'must': ['ial_math','ial_physics'], 'prefer': ['ial_chemistry','ial_fm']},
            'ib': {'must': ['hl_math_aa','hl_physics'], 'prefer': ['hl_chemistry']},
            'ap': {'must': ['ap_calc_bc','ap_physics_c_mech'], 'prefer': ['ap_chemistry']},
            'wace': {'must': ['wace_math_methods','wace_physics'], 'prefer': ['wace_math_specialist']},
            'gaokao': {'must': ['gk_math','gk_physics'], 'prefer': []},
        },
        'eng_elec': {
            'a-level': {'must': ['h2_math','h2_physics'], 'prefer': ['h2_fm','h2_computing']},
            'ial': {'must': ['ial_math','ial_physics'], 'prefer': ['ial_fm','ial_cs']},
            'ib': {'must': ['hl_math_aa','hl_physics'], 'prefer': ['hl_cs']},
            'ap': {'must': ['ap_calc_bc','ap_physics_c_em'], 'prefer': ['ap_cs_a']},
            'wace': {'must': ['wace_math_methods','wace_physics'], 'prefer': ['wace_cs']},
            'gaokao': {'must': ['gk_math','gk_physics'], 'prefer': []},
        },
        'eng_chem': {
            'a-level': {'must': ['h2_math','h2_chemistry'], 'prefer': ['h2_physics']},
            'ial': {'must': ['ial_math','ial_chemistry'], 'prefer': ['ial_physics']},
            'ib': {'must': ['hl_math_aa','hl_chemistry'], 'prefer': ['hl_physics']},
            'ap': {'must': ['ap_calc_bc','ap_chemistry'], 'prefer': ['ap_physics_c_mech']},
            'wace': {'must': ['wace_math_methods','wace_chemistry'], 'prefer': ['wace_physics']},
            'gaokao': {'must': ['gk_math','gk_chemistry'], 'prefer': ['gk_physics']},
        },
        'eng_civil': {
            'a-level': {'must': ['h2_math','h2_physics'], 'prefer': ['h2_chemistry']},
            'ial': {'must': ['ial_math','ial_physics'], 'prefer': ['ial_chemistry']},
            'ib': {'must': ['hl_math_aa','hl_physics'], 'prefer': []},
            'ap': {'must': ['ap_calc_bc','ap_physics_c_mech'], 'prefer': []},
            'wace': {'must': ['wace_math_methods','wace_physics'], 'prefer': []},
            'gaokao': {'must': ['gk_math','gk_physics'], 'prefer': []},
        },
        'eng_general': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_physics','h2_computing']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_physics','ial_cs']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_physics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_physics_c_mech']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_physics']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_physics']},
        },
        'eng_bio': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_biology','h2_chemistry','h2_physics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_biology','ial_chemistry','ial_physics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_biology','hl_chemistry']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_biology','ap_chemistry']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_biology','wace_chemistry']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_biology','gk_chemistry']},
        },
        'medicine': {
            'a-level': {'must': ['h2_chemistry','h2_biology'], 'prefer': ['h2_math','h2_physics']},
            'ial': {'must': ['ial_chemistry','ial_biology'], 'prefer': ['ial_math','ial_physics']},
            'ib': {'must': ['hl_chemistry','hl_biology'], 'prefer': ['hl_math_aa']},
            'ap': {'must': ['ap_chemistry','ap_biology'], 'prefer': ['ap_calc_bc']},
            'wace': {'must': ['wace_chemistry'], 'prefer': ['wace_biology','wace_math_methods']},
            'gaokao': {'must': [], 'prefer': []},
        },
        'health_sci': {
            'a-level': {'must': ['h2_chemistry'], 'prefer': ['h2_biology','h2_math']},
            'ial': {'must': ['ial_chemistry'], 'prefer': ['ial_biology','ial_math']},
            'ib': {'must': ['hl_chemistry'], 'prefer': ['hl_biology','hl_math_aa']},
            'ap': {'must': ['ap_chemistry'], 'prefer': ['ap_biology','ap_calc_bc']},
            'wace': {'must': ['wace_chemistry'], 'prefer': ['wace_biology','wace_math_methods']},
            'gaokao': {'must': [], 'prefer': []},
        },
        'bio_sci': {
            'a-level': {'must': ['h2_biology'], 'prefer': ['h2_chemistry','h2_math']},
            'ial': {'must': ['ial_biology'], 'prefer': ['ial_chemistry','ial_math']},
            'ib': {'must': ['hl_biology'], 'prefer': ['hl_chemistry']},
            'ap': {'must': ['ap_biology'], 'prefer': ['ap_chemistry']},
            'wace': {'must': ['wace_biology'], 'prefer': ['wace_chemistry']},
            'gaokao': {'must': [], 'prefer': ['gk_biology']},
        },
        'chem_sci': {
            'a-level': {'must': ['h2_chemistry'], 'prefer': ['h2_math','h2_physics']},
            'ial': {'must': ['ial_chemistry'], 'prefer': ['ial_math','ial_physics']},
            'ib': {'must': ['hl_chemistry'], 'prefer': ['hl_math_aa']},
            'ap': {'must': ['ap_chemistry'], 'prefer': ['ap_calc_bc']},
            'wace': {'must': ['wace_chemistry'], 'prefer': ['wace_math_methods']},
            'gaokao': {'must': [], 'prefer': ['gk_chemistry']},
        },
        'physics': {
            'a-level': {'must': ['h2_math','h2_physics'], 'prefer': ['h2_fm']},
            'ial': {'must': ['ial_math','ial_physics'], 'prefer': ['ial_fm']},
            'ib': {'must': ['hl_math_aa','hl_physics'], 'prefer': []},
            'ap': {'must': ['ap_calc_bc','ap_physics_c_mech'], 'prefer': []},
            'wace': {'must': ['wace_math_methods','wace_physics'], 'prefer': ['wace_math_specialist']},
            'gaokao': {'must': ['gk_math','gk_physics'], 'prefer': []},
        },
        'math': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_fm','h2_physics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_fm','ial_physics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_physics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_stats']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_math_specialist']},
            'gaokao': {'must': ['gk_math'], 'prefer': []},
        },
        'business': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_economics','h2_management']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_economics','ial_business']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_economics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_macro','ap_micro']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_economics','wace_accounting']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_english']},
        },
        'accounting': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_economics','h2_management']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_accounting','ial_economics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_economics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_macro']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_accounting','wace_economics']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_english']},
        },
        'finance': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_economics','h2_fm']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_economics','ial_fm']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_economics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_stats','ap_macro']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_economics']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_english']},
        },
        'economics': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_economics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_economics']},
            'ib': {'must': ['hl_math_aa'], 'prefer': ['hl_economics']},
            'ap': {'must': ['ap_calc_bc'], 'prefer': ['ap_macro','ap_micro']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_economics']},
            'gaokao': {'must': ['gk_math'], 'prefer': ['gk_english']},
        },
        'law': {
            'a-level': {'must': [], 'prefer': ['h2_literature','h2_history','h2_economics']},
            'ial': {'must': [], 'prefer': ['ial_eng_lit','ial_history','ial_economics']},
            'ib': {'must': [], 'prefer': ['hl_english_a','hl_history','hl_economics']},
            'ap': {'must': ['ap_english_lang'], 'prefer': ['ap_us_history','ap_macro']},
            'wace': {'must': ['wace_english'], 'prefer': ['wace_history','wace_economics']},
            'gaokao': {'must': ['gk_english'], 'prefer': []},
        },
        'humanities': {
            'a-level': {'must': [], 'prefer': ['h2_literature','h2_history','h2_economics']},
            'ial': {'must': [], 'prefer': ['ial_eng_lit','ial_history','ial_economics']},
            'ib': {'must': [], 'prefer': ['hl_english_a','hl_history']},
            'ap': {'must': [], 'prefer': ['ap_english_lang','ap_us_history']},
            'wace': {'must': ['wace_english'], 'prefer': ['wace_history']},
            'gaokao': {'must': ['gk_english'], 'prefer': []},
        },
        'social_sci': {
            'a-level': {'must': [], 'prefer': ['h2_economics','h2_geography','h2_history']},
            'ial': {'must': [], 'prefer': ['ial_sociology','ial_economics','ial_psychology']},
            'ib': {'must': [], 'prefer': ['hl_economics','hl_psychology']},
            'ap': {'must': [], 'prefer': ['ap_psychology','ap_macro']},
            'wace': {'must': [], 'prefer': ['wace_economics']},
            'gaokao': {'must': [], 'prefer': ['gk_english']},
        },
        'psychology': {
            'a-level': {'must': [], 'prefer': ['h2_math','h2_biology','h2_economics']},
            'ial': {'must': [], 'prefer': ['ial_math','ial_psychology','ial_biology']},
            'ib': {'must': [], 'prefer': ['hl_psychology','hl_biology']},
            'ap': {'must': [], 'prefer': ['ap_psychology','ap_stats']},
            'wace': {'must': [], 'prefer': ['wace_math_methods']},
            'gaokao': {'must': [], 'prefer': ['gk_english','gk_biology']},
        },
        'chinese_studies': {
            'a-level': {'must': [], 'prefer': ['h2_chinese','h2_literature']},
            'ial': {'must': [], 'prefer': ['ial_chinese','ial_eng_lit']},
            'ib': {'must': [], 'prefer': ['hl_chinese_a','hl_english_a']},
            'ap': {'must': [], 'prefer': ['ap_english_lang']},
            'wace': {'must': [], 'prefer': ['wace_english']},
            'gaokao': {'must': ['gk_chinese'], 'prefer': ['gk_english']},
        },
        'comm_media': {
            'a-level': {'must': [], 'prefer': ['h2_literature','h2_economics','h2_history']},
            'ial': {'must': [], 'prefer': ['ial_eng_lit','ial_economics','ial_history']},
            'ib': {'must': [], 'prefer': ['hl_english_a','hl_economics']},
            'ap': {'must': [], 'prefer': ['ap_english_lang']},
            'wace': {'must': ['wace_english'], 'prefer': []},
            'gaokao': {'must': ['gk_english'], 'prefer': []},
        },
        'art_design': {
            'a-level': {'must': [], 'prefer': ['h2_art','h2_literature']},
            'ial': {'must': [], 'prefer': ['ial_art','ial_eng_lit']},
            'ib': {'must': [], 'prefer': ['hl_english_a']},
            'ap': {'must': [], 'prefer': ['ap_english_lang']},
            'wace': {'must': [], 'prefer': ['wace_design']},
            'gaokao': {'must': [], 'prefer': ['gk_english']},
        },
        'architecture': {
            'a-level': {'must': ['h2_math'], 'prefer': ['h2_art','h2_physics']},
            'ial': {'must': ['ial_math'], 'prefer': ['ial_art','ial_physics']},
            'ib': {'must': [], 'prefer': ['hl_math_aa']},
            'ap': {'must': [], 'prefer': ['ap_calc_ab']},
            'wace': {'must': ['wace_math_methods'], 'prefer': ['wace_design']},
            'gaokao': {'must': ['gk_math'], 'prefer': []},
        },
        'education': {
            'a-level': {'must': [], 'prefer': ['h2_literature','h2_history']},
            'ial': {'must': [], 'prefer': ['ial_eng_lit','ial_history']},
            'ib': {'must': [], 'prefer': ['hl_english_a']},
            'ap': {'must': [], 'prefer': ['ap_english_lang']},
            'wace': {'must': ['wace_english'], 'prefer': []},
            'gaokao': {'must': ['gk_english'], 'prefer': []},
        },
        'nursing': {
            'a-level': {'must': ['h2_chemistry'], 'prefer': ['h2_biology']},
            'ial': {'must': ['ial_chemistry'], 'prefer': ['ial_biology']},
            'ib': {'must': ['hl_chemistry'], 'prefer': ['hl_biology']},
            'ap': {'must': ['ap_chemistry'], 'prefer': ['ap_biology']},
            'wace': {'must': ['wace_chemistry'], 'prefer': ['wace_biology']},
            'gaokao': {'must': [], 'prefer': ['gk_chemistry','gk_biology']},
        },
        'env_sci': {
            'a-level': {'must': [], 'prefer': ['h2_geography','h2_biology','h2_chemistry']},
            'ial': {'must': [], 'prefer': ['ial_geography','ial_biology','ial_chemistry']},
            'ib': {'must': [], 'prefer': ['hl_geography','hl_biology']},
            'ap': {'must': [], 'prefer': ['ap_biology','ap_chemistry']},
            'wace': {'must': [], 'prefer': ['wace_biology','wace_chemistry']},
            'gaokao': {'must': [], 'prefer': ['gk_biology','gk_geography_gk']},
        },
        'food_sci': {
            'a-level': {'must': ['h2_chemistry'], 'prefer': ['h2_biology']},
            'ial': {'must': ['ial_chemistry'], 'prefer': ['ial_biology']},
            'ib': {'must': ['hl_chemistry'], 'prefer': ['hl_biology']},
            'ap': {'must': ['ap_chemistry'], 'prefer': ['ap_biology']},
            'wace': {'must': ['wace_chemistry'], 'prefer': ['wace_biology']},
            'gaokao': {'must': [], 'prefer': ['gk_chemistry','gk_biology']},
        },
        'music': {
            'a-level': {'must': [], 'prefer': ['h2_music']},
            'ial': {'must': [], 'prefer': []},
            'ib': {'must': [], 'prefer': []},
            'ap': {'must': [], 'prefer': []},
            'wace': {'must': [], 'prefer': []},
            'gaokao': {'must': [], 'prefer': ['gk_english']},
        },
        'general_no_req': {
            'a-level': {'must': [], 'prefer': []},
            'ial': {'must': [], 'prefer': []},
            'ib': {'must': [], 'prefer': []},
            'ap': {'must': [], 'prefer': []},
            'wace': {'must': [], 'prefer': []},
            'gaokao': {'must': [], 'prefer': ['gk_english']},
        },
    }

    p = profiles[profile]

    # Generate grade strings based on difficulty
    def grade_str(exam, diff):
        if exam == 'a-level':
            if diff >= 95: return 'AAA/A (4A)'
            if diff >= 90: return 'AAA/A'
            if diff >= 85: return 'AAB/B'
            if diff >= 80: return 'ABB/B'
            if diff >= 75: return 'ABB/C'
            if diff >= 70: return 'BBC/C'
            if diff >= 65: return 'BCC/C'
            return 'CCC/C'
        elif exam == 'ial':
            if diff >= 95: return "A*A*A"
            if diff >= 90: return "A*AA"
            if diff >= 85: return "AAA"
            if diff >= 80: return "AAB"
            if diff >= 75: return "ABB"
            if diff >= 70: return "BBB"
            if diff >= 65: return "BBC"
            return "BCC"
        elif exam == 'ib':
            if diff >= 95: return f'{min(45,diff//2+2)}+'
            if diff >= 90: return f'{diff//2+1}+'
            if diff >= 80: return f'{diff//2}+'
            if diff >= 70: return f'{diff//2-1}+'
            return f'{max(24,diff//2-2)}+'
        elif exam == 'ap':
            if diff >= 90: return '5/5/5'
            if diff >= 80: return '5/5'
            if diff >= 70: return '4+'
            return '3+'
        elif exam == 'wace':
            base = max(65, min(98, diff + 2))
            return f'ATAR {base}+'
        elif exam == 'gaokao':
            if diff >= 95: return '省Top0.5%'
            if diff >= 90: return '省Top2%'
            if diff >= 85: return '省Top5%'
            if diff >= 80: return '省Top8%'
            if diff >= 75: return '省Top10%'
            if diff >= 70: return '省Top15%'
            if diff >= 65: return '省Top20%'
            return '省Top25%'
        return '—'

    req = {}
    for exam in ['a-level','ial','ib','ap','wace','gaokao']:
        e = p[exam]
        g = grade_override.get(exam) if grade_override and exam in grade_override else grade_str(exam, diff)
        req[exam] = {
            'must': e['must'],
            'prefer': e['prefer'],
            'grade': g,
            'igp': '—'
        }
    return req


def fmt_req(req):
    """Format a req dict as JS object literal."""
    parts = []
    for exam in ['a-level','ial','ib','ap','wace','gaokao']:
        r = req[exam]
        must_str = ','.join(f"'{k}'" for k in r['must'])
        prefer_str = ','.join(f"'{k}'" for k in r['prefer'])
        parts.append(f"'{exam}':{{must:[{must_str}],prefer:[{prefer_str}],grade:'{r['grade']}',igp:'{r['igp']}'}}")
    return '{' + ','.join(parts) + '}'


def fmt_program(p):
    """Format a program entry as JS object literal."""
    req_str = fmt_req(p['req'])
    # Escape single quotes in strings
    program = p['program'].replace("'", "\\'")
    cn = p['cn'].replace("'", "\\'")
    faculty = p['faculty'].replace("'", "\\'")
    return (
        f"    {{uni:'{p['uni']}',uniName:'{p['uniName']}',uniCN:'{p['uniCN']}',"
        f"program:'{program}',cn:'{cn}',faculty:'{faculty}',\n"
        f"     req:{req_str},diff:{p['diff']}}}"
    )


# ═══════════════════════════════════════════
# FULL PROGRAM DATABASE
# ═══════════════════════════════════════════

programs = []

def add(uni, uniName, uniCN, program, cn, faculty, profile, diff, grade_override=None):
    programs.append({
        'uni': uni, 'uniName': uniName, 'uniCN': uniCN,
        'program': program, 'cn': cn, 'faculty': faculty,
        'req': make_req(profile, diff, grade_override),
        'diff': diff
    })

# ─────────────────────────────────────────
# NUS
# ─────────────────────────────────────────
U = ('nus', 'NUS', '新加坡国立大学')

# School of Computing
add(*U, 'Computer Science', '计算机科学', 'School of Computing', 'cs', 94)
add(*U, 'Business Analytics', '商业分析', 'School of Computing', 'data_science', 92)
add(*U, 'Information Security', '信息安全', 'School of Computing', 'cs', 91)
add(*U, 'Computer Engineering', '计算机工程', 'School of Computing / CDE', 'cs', 92)
add(*U, 'Information Systems', '信息系统', 'School of Computing', 'computing', 88)
add(*U, 'Artificial Intelligence', '人工智能', 'School of Computing', 'cs', 94)

# College of Design and Engineering
add(*U, 'Architecture', '建筑学', 'College of Design and Engineering', 'architecture', 83)
add(*U, 'Industrial Design', '工业设计', 'College of Design and Engineering', 'art_design', 80)
add(*U, 'Landscape Architecture', '景观建筑', 'College of Design and Engineering', 'architecture', 78)
add(*U, 'Biomedical Engineering', '生物医学工程', 'College of Design and Engineering', 'eng_bio', 85)
add(*U, 'Chemical Engineering', '化学工程', 'College of Design and Engineering', 'eng_chem', 83)
add(*U, 'Civil Engineering', '土木工程', 'College of Design and Engineering', 'eng_civil', 80)
add(*U, 'Electrical Engineering', '电子工程', 'College of Design and Engineering', 'eng_elec', 85)
add(*U, 'Environmental and Sustainability Engineering', '环境与可持续工程', 'College of Design and Engineering', 'eng_chem', 78)
add(*U, 'Industrial and Systems Engineering', '工业与系统工程', 'College of Design and Engineering', 'eng_general', 82)
add(*U, 'Materials Science Engineering', '材料科学工程', 'College of Design and Engineering', 'eng_chem', 80)
add(*U, 'Mechanical Engineering', '机械工程', 'College of Design and Engineering', 'eng_mech', 85)
add(*U, 'Engineering Science', '工程科学', 'College of Design and Engineering', 'eng_mech', 88)
add(*U, 'Infrastructure & Project Management', '基建与项目管理', 'College of Design and Engineering', 'eng_civil', 78)
add(*U, 'Robotics & Machine Intelligence', '机器人与机器智能', 'College of Design and Engineering', 'eng_elec', 90)

# Business School
add(*U, 'Business Administration', '工商管理', 'NUS Business School', 'business', 92)

# Faculty of Law
add(*U, 'Law', '法律', 'Faculty of Law', 'law', 97)

# Medicine & Health
add(*U, 'Medicine', '医学', 'Yong Loo Lin School of Medicine', 'medicine', 98)
add(*U, 'Dentistry', '牙医', 'Faculty of Dentistry', 'medicine', 97)
add(*U, 'Nursing', '护理学', 'Alice Lee Centre for Nursing Studies', 'nursing', 75)
add(*U, 'Pharmacy', '药学', 'Department of Pharmacy', 'health_sci', 85)

# Faculty of Science
add(*U, 'Data Science & Analytics', '数据科学与分析', 'Faculty of Science', 'data_science', 91)
add(*U, 'Chemistry', '化学', 'Faculty of Science', 'chem_sci', 78)
add(*U, 'Physics', '物理', 'Faculty of Science', 'physics', 82)
add(*U, 'Mathematics', '数学', 'Faculty of Science', 'math', 85)
add(*U, 'Statistics', '统计学', 'Faculty of Science', 'math', 83)
add(*U, 'Life Sciences', '生命科学', 'Faculty of Science', 'bio_sci', 78)
add(*U, 'Food Science & Technology', '食品科学与技术', 'Faculty of Science', 'food_sci', 76)
add(*U, 'Pharmaceutical Science', '药学科学', 'Faculty of Science', 'chem_sci', 80)
add(*U, 'Quantitative Finance', '量化金融', 'Faculty of Science', 'finance', 90)

# Faculty of Arts and Social Sciences
add(*U, 'Economics', '经济学', 'Faculty of Arts and Social Sciences', 'economics', 89)
add(*U, 'Political Science', '政治学', 'Faculty of Arts and Social Sciences', 'social_sci', 83)
add(*U, 'Psychology', '心理学', 'Faculty of Arts and Social Sciences', 'psychology', 83)
add(*U, 'Sociology', '社会学', 'Faculty of Arts and Social Sciences', 'social_sci', 78)
add(*U, 'Communications & New Media', '传播与新媒体', 'Faculty of Arts and Social Sciences', 'comm_media', 82)
add(*U, 'English Language & Linguistics', '英语语言学', 'Faculty of Arts and Social Sciences', 'humanities', 80)
add(*U, 'English Literature', '英语文学', 'Faculty of Arts and Social Sciences', 'humanities', 78)
add(*U, 'History', '历史学', 'Faculty of Arts and Social Sciences', 'humanities', 78)
add(*U, 'Philosophy', '哲学', 'Faculty of Arts and Social Sciences', 'humanities', 78)
add(*U, 'Geography', '地理学', 'Faculty of Arts and Social Sciences', 'social_sci', 78)
add(*U, 'Social Work', '社会工作', 'Faculty of Arts and Social Sciences', 'social_sci', 75)
add(*U, 'Chinese Studies', '中国研究', 'Faculty of Arts and Social Sciences', 'chinese_studies', 75)
add(*U, 'Japanese Studies', '日本研究', 'Faculty of Arts and Social Sciences', 'humanities', 75)
add(*U, 'Malay Studies', '马来研究', 'Faculty of Arts and Social Sciences', 'humanities', 73)
add(*U, 'Southeast Asian Studies', '东南亚研究', 'Faculty of Arts and Social Sciences', 'humanities', 73)
add(*U, 'Theatre & Performance Studies', '戏剧与表演', 'Faculty of Arts and Social Sciences', 'art_design', 75)
add(*U, 'Anthropology', '人类学', 'Faculty of Arts and Social Sciences', 'social_sci', 75)

# Cross-Disciplinary
add(*U, 'Philosophy, Politics & Economics', '哲学政治与经济', 'College of Humanities & Sciences', 'economics', 90)
add(*U, 'Data Science & Economics', '数据科学与经济', 'College of Humanities & Sciences', 'data_science', 90)
add(*U, 'Environmental Studies', '环境研究', 'College of Humanities & Sciences', 'env_sci', 78)
add(*U, 'Global Studies', '全球研究', 'Faculty of Arts and Social Sciences', 'humanities', 80)

# Music
add(*U, 'Music', '音乐', 'Yong Siew Toh Conservatory of Music', 'music', 80)

# ─────────────────────────────────────────
# NTU
# ─────────────────────────────────────────
U = ('ntu', 'NTU', '南洋理工大学')

# College of Business
add(*U, 'Business', '商学', 'Nanyang Business School', 'business', 87)
add(*U, 'Accountancy', '会计学', 'Nanyang Business School', 'accounting', 85)
add(*U, 'Accountancy (Sustainability)', '会计学（可持续管理）', 'Nanyang Business School', 'accounting', 83)

# CCDS
add(*U, 'Computer Science', '计算机科学', 'College of Computing and Data Science', 'cs', 92)
add(*U, 'Data Science & AI', '数据科学与人工智能', 'College of Computing and Data Science', 'data_science', 90)
add(*U, 'Computer Engineering', '计算机工程', 'College of Engineering', 'cs', 88)
add(*U, 'Artificial Intelligence and Society', '人工智能与社会', 'College of Computing and Data Science', 'cs', 88)
add(*U, 'Applied Computing in Finance', '应用计算与金融', 'College of Computing and Data Science / NBS', 'computing', 85)
add(*U, 'Mathematical and Computer Sciences', '数学与计算机科学', 'SPMS / CCDS', 'cs', 85)

# College of Engineering
add(*U, 'Aerospace Engineering', '航空航天工程', 'College of Engineering', 'eng_mech', 85)
add(*U, 'Bioengineering', '生物工程', 'College of Engineering', 'eng_bio', 80)
add(*U, 'Chemical & Biomolecular Engineering', '化学与生物分子工程', 'College of Engineering', 'eng_chem', 80)
add(*U, 'Civil Engineering', '土木工程', 'College of Engineering', 'eng_civil', 78)
add(*U, 'Electrical & Electronic Engineering', '电子电气工程', 'College of Engineering', 'eng_elec', 80)
add(*U, 'Environmental Engineering', '环境工程', 'College of Engineering', 'eng_chem', 75)
add(*U, 'Information Engineering & Media', '信息工程与媒体', 'College of Engineering', 'eng_elec', 82)
add(*U, 'Materials Engineering', '材料工程', 'College of Engineering', 'eng_chem', 78)
add(*U, 'Mechanical Engineering', '机械工程', 'College of Engineering', 'eng_mech', 80)
add(*U, 'Robotics', '机器人', 'College of Engineering', 'eng_elec', 85)
add(*U, 'Maritime Studies', '海事研究', 'School of Civil and Environmental Engineering', 'eng_civil', 75)

# Medicine
add(*U, 'Medicine (LKCMedicine)', '医学', 'Lee Kong Chian School of Medicine', 'medicine', 98)

# CoHASS
add(*U, 'Fine Arts', '美术', 'School of Art, Design and Media', 'art_design', 78)
add(*U, 'Communication Studies', '传播学', 'Wee Kim Wee School of Communication', 'comm_media', 80)
add(*U, 'Economics', '经济学', 'School of Social Sciences', 'economics', 85)
add(*U, 'Psychology', '心理学', 'School of Social Sciences', 'psychology', 82)
add(*U, 'Sociology', '社会学', 'School of Social Sciences', 'social_sci', 75)
add(*U, 'Public Policy & Global Affairs', '公共政策与全球事务', 'School of Social Sciences', 'social_sci', 82)
add(*U, 'Philosophy, Politics & Economics', '哲学政治与经济', 'School of Social Sciences', 'economics', 85)
add(*U, 'Linguistics & Multilingual Studies', '语言学与多语研究', 'School of Humanities', 'humanities', 75)
add(*U, 'English', '英语', 'School of Humanities', 'humanities', 75)
add(*U, 'Chinese', '中文', 'School of Humanities', 'chinese_studies', 73)
add(*U, 'History', '历史', 'School of Humanities', 'humanities', 75)
add(*U, 'Philosophy', '哲学', 'School of Humanities', 'humanities', 73)
add(*U, 'Economics and Data Science', '经济学与数据科学', 'SSS / CCDS / SPMS', 'data_science', 85)
add(*U, 'Sport Science and Management', '运动科学与管理', 'NIE', 'bio_sci', 75)

# College of Science
add(*U, 'Biological Sciences', '生物科学', 'School of Biological Sciences', 'bio_sci', 78)
add(*U, 'Chemistry & Biological Chemistry', '化学与生物化学', 'School of Chemistry', 'chem_sci', 78)
add(*U, 'Mathematical Sciences', '数学科学', 'School of Physical & Mathematical Sciences', 'math', 80)
add(*U, 'Physics & Applied Physics', '物理与应用物理', 'School of Physical & Mathematical Sciences', 'physics', 78)
add(*U, 'Environmental Earth Systems Science', '环境地球系统科学', 'Asian School of the Environment', 'env_sci', 75)
add(*U, 'Chinese Medicine', '中医', 'School of Chemistry', 'health_sci', 78)

# ─────────────────────────────────────────
# SMU
# ─────────────────────────────────────────
U = ('smu', 'SMU', '新加坡管理大学')

add(*U, 'Business Management', '商业管理', 'Lee Kong Chian School of Business', 'business', 87)
add(*U, 'Accountancy', '会计学', 'School of Accountancy', 'accounting', 85)
add(*U, 'Economics', '经济学', 'School of Economics', 'economics', 85)
add(*U, 'Information Systems', '信息系统', 'School of Computing & Information Systems', 'computing', 85)
add(*U, 'Computer Science', '计算机科学', 'School of Computing & Information Systems', 'cs', 90)
add(*U, 'Software Engineering', '软件工程', 'School of Computing & Information Systems', 'cs', 88)
add(*U, 'Computing & Law', '计算与法律', 'SCIS / School of Law', 'cs', 92)
add(*U, 'Law', '法律', 'Yong Pung How School of Law', 'law', 95)
add(*U, 'Social Sciences', '社会科学', 'School of Social Sciences', 'social_sci', 80)
add(*U, 'Psychology', '心理学（社科）', 'School of Social Sciences', 'psychology', 82)
add(*U, 'Politics, Law & Economics', '政治法律与经济', 'School of Social Sciences', 'social_sci', 85)
add(*U, 'Integrative Studies', '综合研究', 'College of Integrative Studies', 'humanities', 78)

# ─────────────────────────────────────────
# SUTD
# ─────────────────────────────────────────
U = ('sutd', 'SUTD', '新加坡科技设计大学')

add(*U, 'Architecture & Sustainable Design', '建筑与可持续设计', 'SUTD', 'architecture', 82)
add(*U, 'Computer Science & Design', '计算机科学与设计', 'SUTD', 'cs', 85)
add(*U, 'Design & Artificial Intelligence', '设计与人工智能', 'SUTD', 'data_science', 85)
add(*U, 'Engineering Product Development', '工程产品开发', 'SUTD', 'eng_mech', 82)
add(*U, 'Engineering Systems & Design', '工程系统与设计', 'SUTD', 'eng_general', 80)

# ─────────────────────────────────────────
# SIT
# ─────────────────────────────────────────
U = ('sit', 'SIT', '新加坡理工大学')

# Computing & IT
add(*U, 'Applied AI', '应用人工智能', 'Infocomm Technology', 'cs', 82)
add(*U, 'Applied Computing (Fintech)', '应用计算（金融科技）', 'Infocomm Technology', 'computing', 80)
add(*U, 'Computer Engineering', '计算机工程', 'Infocomm Technology', 'cs', 80)
add(*U, 'Computer Science (Interactive Media & Game Dev)', '计算机科学（互动媒体）', 'Infocomm Technology / DigiPen', 'cs', 78)
add(*U, 'Computer Science (Real-Time Interactive Simulation)', '计算机科学（实时交互仿真）', 'Infocomm Technology / DigiPen', 'cs', 78)
add(*U, 'Computing Science', '计算科学', 'Infocomm Technology / U of Glasgow', 'computing', 78)
add(*U, 'ICT (Information Security)', 'ICT（信息安全）', 'Infocomm Technology', 'computing', 78)
add(*U, 'ICT (Software Engineering)', 'ICT（软件工程）', 'Infocomm Technology', 'computing', 78)
add(*U, 'Digital Art & Animation', '数字艺术与动画', 'DigiPen Singapore', 'art_design', 72)
add(*U, 'User Experience & Game Design', '用户体验与游戏设计', 'DigiPen Singapore', 'art_design', 72)

# Engineering
add(*U, 'Aircraft Systems Engineering', '飞机系统工程', 'Engineering', 'eng_mech', 78)
add(*U, 'Civil Engineering', '土木工程', 'Engineering', 'eng_civil', 75)
add(*U, 'Chemical Engineering', '化学工程', 'Engineering / TU Munich', 'eng_chem', 78)
add(*U, 'Electrical & Electronic Engineering', '电子电气工程', 'Engineering', 'eng_elec', 75)
add(*U, 'Electrical Power Engineering', '电力工程', 'Engineering / Newcastle', 'eng_elec', 73)
add(*U, 'Electronics & Data Engineering', '电子与数据工程', 'Engineering / TU Munich', 'eng_elec', 78)
add(*U, 'Mechanical Engineering', '机械工程', 'Engineering / U of Glasgow', 'eng_mech', 75)
add(*U, 'Mechanical Design & Manufacturing', '机械设计与制造', 'Engineering / Newcastle', 'eng_mech', 73)
add(*U, 'Naval Architecture & Marine Engineering', '船舶与海洋工程', 'Engineering / Newcastle', 'eng_mech', 73)
add(*U, 'Robotics Systems', '机器人系统', 'Engineering', 'eng_elec', 78)
add(*U, 'Sustainable Built Environment', '可持续建筑环境', 'Engineering', 'eng_civil', 72)
add(*U, 'Infrastructure & Systems Engineering', '基建与系统工程', 'Engineering', 'eng_general', 73)

# Health
add(*U, 'Dietetics & Nutrition', '营养学', 'Health and Social Sciences', 'bio_sci', 78)
add(*U, 'Diagnostic Radiography', '诊断放射学', 'Health and Social Sciences', 'health_sci', 78)
add(*U, 'Occupational Therapy', '职业治疗', 'Health and Social Sciences', 'bio_sci', 78)
add(*U, 'Physiotherapy', '物理治疗', 'Health and Social Sciences', 'bio_sci', 80)
add(*U, 'Speech & Language Therapy', '言语治疗', 'Health and Social Sciences', 'bio_sci', 78)
add(*U, 'Nursing', '护理学', 'Health and Social Sciences', 'nursing', 72)
add(*U, 'Radiation Therapy', '放射治疗', 'Health and Social Sciences', 'health_sci', 78)

# Business & Others
add(*U, 'Accountancy', '会计学', 'Business, Communication and Design', 'accounting', 73)
add(*U, 'Hospitality & Tourism Management', '酒店与旅游管理', 'Business, Communication and Design', 'general_no_req', 70)
add(*U, 'Communication & Digital Media', '传播与数字媒体', 'Business, Communication and Design', 'comm_media', 72)
add(*U, 'Digital Supply Chain', '数字供应链', 'Business, Communication and Design', 'business', 73)
add(*U, 'Aviation Management', '航空管理', 'Engineering', 'general_no_req', 72)

# Food & Pharma
add(*U, 'Food Technology', '食品技术', 'Food, Chemical and Biotechnology', 'food_sci', 75)
add(*U, 'Pharmaceutical Engineering', '制药工程', 'Food, Chemical and Biotechnology', 'eng_chem', 78)

# ─────────────────────────────────────────
# SUSS (full-time only for international students)
# ─────────────────────────────────────────
U = ('suss', 'SUSS', '新跃社科大学')

add(*U, 'Accountancy', '会计学', 'School of Business', 'accounting', 72)
add(*U, 'Business Analytics', '商业分析', 'School of Business', 'data_science', 73)
add(*U, 'Finance', '金融学', 'School of Business', 'finance', 73)
add(*U, 'Marketing', '市场营销', 'School of Business', 'general_no_req', 68)
add(*U, 'Supply Chain Management', '供应链管理', 'School of Business', 'business', 70)
add(*U, 'Early Childhood Education', '学前教育', 'S R Nathan School of Human Development', 'education', 68)
add(*U, 'Human Resource Management', '人力资源管理', 'S R Nathan School of Human Development', 'social_sci', 68)
add(*U, 'Social Work', '社会工作', 'S R Nathan School of Human Development', 'social_sci', 65)
add(*U, 'Chinese Studies', '中国研究', 'School of Humanities and Behavioural Sciences', 'chinese_studies', 68)
add(*U, 'Psychology', '心理学', 'School of Humanities and Behavioural Sciences', 'psychology', 72)
add(*U, 'Public Safety & Security', '公共安全', 'School of Humanities and Behavioural Sciences', 'social_sci', 68)
add(*U, 'ICT', '信息与通信技术', 'School of Science and Technology', 'computing', 72)


# ═══════════════════════════════════════════
# GENERATE JS
# ═══════════════════════════════════════════

# Count by university
counts = {}
for p in programs:
    counts[p['uni']] = counts.get(p['uni'], 0) + 1

print("Program counts by university:")
for uni, count in counts.items():
    print(f"  {uni.upper()}: {count}")
print(f"  TOTAL: {len(programs)}")

# Generate JS array content
js_lines = ['  const PROGRAMS=[']

current_uni = None
for p in programs:
    if p['uni'] != current_uni:
        current_uni = p['uni']
        js_lines.append(f"    // ─── {p['uniName']} ({p['uniCN']}) ───")
    js_lines.append(fmt_program(p) + ',')

js_lines.append('  ];')

js_output = '\n'.join(js_lines)

# Read the file and replace PROGRAMS array
with open('pathway/university-matcher/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# Find and replace the PROGRAMS array
pattern = r'  const PROGRAMS=\[[\s\S]*?\];'
match = re.search(pattern, content)
if match:
    new_content = content[:match.start()] + js_output + content[match.end():]
    with open('pathway/university-matcher/index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"\nReplaced PROGRAMS array ({match.end()-match.start()} chars -> {len(js_output)} chars)")
    print("File updated successfully!")
else:
    print("ERROR: Could not find PROGRAMS array!")
