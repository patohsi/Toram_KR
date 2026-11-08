const Arrow = {
    id: "arrow",
    name: "✨화살 (Arrow)",
    url_param: "Arrow",
    description: "활 및 자동활의 보조 장비입니다. 속성을 부여하고 공격력과 안정률을 보정합니다.",
    items: [
        // ==========================================
        // 무속성 (Neutral)
        // ==========================================
        {
            category: "무속성",
            name: "벚꽃 화살",
            name_en: "Cherry Blossom Arrow",
            atk: 136,
            stability: "20%",
            stats: ["무속성 데미지+5%", "HP 자연회복+10%", "어그로-20%"],
            drop: "벚꽃 축제 이벤트 6장 클리어 후 주선폭포 보스 '만개한 주맹' 부위파괴"
        },
        {
            category: "무속성",
            name: "주맹 화살",
            name_en: "Jue Arrow",
            atk: 160,
            stability: "20%",
            stats: ["최대 MP+200", "크리티컬률+10", "(활 장비 시) 원거리 위력+2%"],
            drop: "벚꽃 축제 이벤트 대장간 제작"
        },
        {
            category: "무속성",
            name: "황녀의 화살",
            name_en: "Empress Arrow",
            atk: 83,
            stability: "20%",
            stats: ["공격속도+10%", "물리관통+10%", "어그로-10%", "DEF-30%"],
            drop: "황녀의 궁전 '베네나 코에누비아' 드랍"
        },
        {
            category: "무속성",
            name: "크리스탈 애로우",
            name_en: "Crystal Arrow",
            atk: 115,
            stability: "20%",
            stats: ["크리티컬률+10"],
            drop: "은파의 소호 '스몰티다' 드랍"
        },
        {
            category: "무속성",
            name: "드라이버 볼트",
            name_en: "Driver Bolt",
            atk: 200,
            stability: "20%",
            stats: ["공마회+3", "무내성+15%"],
            drop: "크리스마스 이벤트 중 요울프의 집/차량기지의 '점검 골렘(잡몹)' 드랍"
        },
        // ==========================================
        // 불속성 (Fire)
        // ==========================================
        {
            category: "불속성",
            name: "황마의 화살",
            name_en: "Empress Soul Arrow",
            atk: 120,
            stability: "10%",
            stats: ["명중+15%", "어그로-15%"],
            drop: "네오 플라스티다 '베네나 메타코에누비아' 드랍"
        },
        {
            category: "불속성",
            name: "사랑의 화살",
            name_en: "Love Arrow",
            atk: 71,
            stability: "20%",
            stats: ["크리티컬률+5"],
            drop: "발렌타인 데이 이벤트 대장간 제작"
        },
        {
            category: "불속성",
            name: "화염의 활",
            name_en: "Flame Arrow",
            atk: 34,
            stability: "20%",
            stats: ["최대 MP+100"],
            drop: "어둠의 거울 '사니온' 드랍"
        },
        // ==========================================
        // 물속성 (Water)
        // ==========================================
        {
            category: "물속성",
            name: "오션 애로우",
            name_en: "Ocean Arrow",
            atk: 110,
            stability: "10%",
            stats: ["최대 MP+200", "공마회+1", "바람내성-3%"],
            drop: "여름 이벤트 대장간 제작"
        },
        {
            category: "물속성",
            name: "천음 화살",
            name_en: "Stream Arrow",
            atk: 84,
            stability: "20%",
            stats: ["절대명중+1%", "부여정지(넘어짐)"],
            drop: "프랙텀 지구 '플로러트(잡몹)' 드랍"
        },
        {
            category: "물속성",
            name: "얼음 화살",
            name_en: "Ice Arrow",
            atk: 17,
            stability: "20%",
            stats: ["크리티컬률+2"],
            drop: "대장간 제작"
        },
        // ==========================================
        // 바람속성 (Wind)
        // ==========================================
        {
            category: "바람속성",
            name: "여왕벌의 화살",
            name_en: "Queen Bee Arrow",
            atk: 150,
            stability: "20%",
            stats: ["물리추격+10%", "물내성+5%", "부여정지(넘어짐)"],
            drop: "발렌타인 데이 이벤트 대장간 제작"
        },
        {
            category: "바람속성",
            name: "사과 화살",
            name_en: "Apple Arrow",
            atk: 92,
            stability: "15%",
            stats: ["어그로-10%"],
            drop: "다키트 지구 '황금코린' 드랍"
        },
        {
            category: "바람속성",
            name: "템페스트 애로우",
            name_en: "Tempest Arrow",
            atk: 15,
            stability: "20%",
            stats: ["크리티컬 데미지+1%", "명중+10%"],
            drop: "혼성의 땅 '포레스티아' 부위파괴 보상"
        },
        // ==========================================
        // 땅속성 (Earth)
        // ==========================================
        {
            category: "땅속성",
            name: "숲 지킴이 화살",
            name_en: "Forest Keeper Arrow",
            atk: 163,
            stability: "20%",
            stats: ["명중+50%", "어그로-25%", "불속성 데미지-10%", "빛속성 데미지-20%"],
            drop: "수호의 수림 / 미혹의 숲 '주목가젤' 드랍"
        },
        {
            category: "땅속성",
            name: "카카오 애로우",
            name_en: "Cacao Arrow",
            atk: 50,
            stability: "20%",
            stats: ["크리티컬률+3", "어그로-6%"],
            drop: "발렌타인 데이 이벤트 대장간 제작"
        },
        {
            category: "땅속성",
            name: "광산의 뾰족한 화살",
            name_en: "Mine Spike Arrow",
            atk: 43,
            stability: "20%",
            stats: ["DEF+50", "물리내성+3%", "명중-1%"],
            drop: "싱고렐라 유적 '케이브 렛(잡몹)' 드랍"
        },
        // ==========================================
        // 빛속성 (Light)
        // ==========================================
        {
            category: "빛속성",
            name: "성스러운 나무의 화살",
            name_en: "Holy Tree Arrow",
            atk: 100,
            stability: "20%",
            stats: ["공마회+1", "어둠내성+10%"],
            drop: "크리스마스 이벤트 퀘스트 중 '산타 냐모(잡몹)' 드랍"
        },
        {
            category: "빛속성",
            name: "사탕세공 활(화살)",
            name_en: "Candywork Arrow (Bow)",
            atk: 56,
            stability: "20%",
            stats: ["MDEF+10%", "마법내성+10%"],
            drop: "화이트데이 이벤트 대장간 제작"
        },
        {
            category: "빛속성",
            name: "플래시 볼트",
            name_en: "Flash Bolt",
            atk: 3,
            stability: "15%",
            stats: ["명중+10", "빛속성 데미지-50%"],
            drop: "엘 스카로 NPC 유안의 퀘스트 '추억의 의미' 보상"
        },
        // ==========================================
        // 어둠속성 (Dark)
        // ==========================================
        {
            category: "어둠속성",
            name: "밤 벚꽃 화살",
            name_en: "Night Cherry Blossom Arrow",
            atk: 100,
            stability: "20%",
            stats: ["빛내성+5%"],
            drop: "벚꽃 이벤트 제5장 '아말감' 부위파괴 보상"
        },
        {
            category: "어둠속성",
            name: "가시 화살",
            name_en: "Spike Arrow",
            atk: 79,
            stability: "20%",
            stats: ["마법내성+5%", "장판경감+5%"],
            drop: "암룡의 신전 '헤데라(잡몹)' 드랍"
        },
        {
            category: "어둠속성",
            name: "어스름의 화살",
            name_en: "Twilight Arrow",
            atk: 40,
            stability: "20%",
            stats: ["이상내성+5%", "최대 HP-10%"],
            drop: "솔피니 산악요새 '어스름의 용' 부위파괴 드랍"
        }
    ]
};