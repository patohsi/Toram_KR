const Dagger = {
    id: "dagger",
    name: "✨단검 (Dagger)",
    url_param: "Dagger",
    description: "보조 무기로 사용되는 단검 목록입니다. 공격력과 다양한 버프 옵션을 제공합니다.",
    items: [
        // ==========================================
        // 대장간 / 드랍 (Blacksmith / Drop)
        // ==========================================
        {
            category: "대장간/드랍",
            name: "스로잉 나이프",
            name_en: "Throwing Knife",
            atk: 4,
            stats: ["Avoid 회복+10%"],
            drop: "대장간 / 초반 몬스터"
        },
        {
            category: "대장간/드랍",
            name: "파워 나이프",
            name_en: "Power Knife",
            atk: 8,
            stats: ["STR+2", "무기 ATK+4"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "대거",
            name_en: "Dagger",
            atk: 12,
            stats: ["Avoid 회복+10%", "회피+3"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "중후한 나이프",
            name_en: "Heavy Knife",
            atk: 17,
            stats: ["크리티컬률+5", "STR+3", "명중-3"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "마법의 단검",
            name_en: "Magic Dagger",
            atk: 15,
            stats: ["공격 MP 회복+1", "시전속도+50", "Avoid 회복+5%"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "패리 나이프",
            name_en: "Parry Knife",
            atk: 22,
            stats: ["Guard 회복+15%", "Guard력+15%", "명중+5"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "부쉬 나이프",
            name_en: "Bush Knife",
            atk: 54,
            stats: ["무기 ATK+10", "물리관통+6%", "공격속도-2%"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "아미 나이프",
            name_en: "Army Knife",
            atk: 27,
            stats: ["최대 MP+100", "DEX+2", "Avoid 회복+10%"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "경량 나이프",
            name_en: "Light Knife",
            atk: 33,
            stats: ["Avoid 회복+15%", "공격속도+100", "마법내성-10%"],
            drop: "대장간, 솔피니 산악요새: 고블린"
        },
        {
            category: "대장간/드랍",
            name: "흡혈 나이프",
            name_en: "Blood Knife",
            atk: 40,
            stats: ["HP 자연회복+5%", "공격 MP 회복+5", "안정률-10%"],
            drop: "대장간"
        },
        {
            category: "대장간/드랍",
            name: "쿠쿠리 나이프",
            name_en: "Kukri Knife",
            atk: 50,
            stats: ["Avoid 회복+10%", "물리추격 50%", "명중+10"],
            drop: "대장간"
        },
        // ==========================================
        // 퀘스트 (Quest)
        // ==========================================
        {
            category: "퀘스트",
            name: "나이프 샤프트",
            name_en: "Knife Shaft",
            atk: 20,
            stats: ["크리티컬 데미지+1", "Avoid 회복+10%", "(자동활 장비 시) 무기 ATK+30"],
            drop: "소피아거리 / 조노: 샘에 눌러앉은 괴물"
        },
        {
            category: "퀘스트",
            name: "항해사의 단검",
            name_en: "Navigator Dagger",
            atk: 30,
            stats: ["MATK+1%", "최대 MP+100", "원거리 위력-3%"],
            drop: "소피아거리 / 포프: 수호꽃"
        },
        {
            category: "퀘스트",
            name: "패링 대거",
            name_en: "Parrying Dagger",
            atk: 22,
            stats: ["Guard 회복+20%", "Guard력+20%", "(자동활 장비 시) 크리티컬률+5"],
            drop: "소피아거리 / 조노: 요새의 술 친구"
        },
        {
            category: "퀘스트",
            name: "매직 대거",
            name_en: "Magic Dagger (Quest)",
            atk: 30,
            stats: ["최대 MP+300", "마법추격 70%"],
            drop: "엘 스카로 / 리노: 캐러밴 습격자"
        },
        {
            category: "퀘스트",
            name: "둔하게 빛나는 나이프",
            name_en: "Dull Shining Knife",
            atk: 54,
            stats: ["크리티컬률+4", "AGI+2"],
            drop: "시작의 정원 / 연구자였던 영혼: 특효약 완성?"
        },
        // ==========================================
        // 필드 / 보스 (Field / Boss)
        // ==========================================
        {
            category: "필드/보스",
            name: "뾰족한 가지 나이프",
            name_en: "Spiky Branch Knife",
            atk: 14,
            stats: ["크리티컬률+1", "(자동활 장비 시) 안정률+7%"],
            drop: "니셀 산: 플란타"
        },
        {
            category: "필드/보스",
            name: "스톰 대거",
            name_en: "Storm Dagger",
            atk: 20,
            stats: ["회피+7%", "크리티컬률+7%", "공격속도+7%"],
            drop: "혼성의 땅: 포레스티아 (입장보스)"
        },
        {
            category: "필드/보스",
            name: "저주받은 단검",
            name_en: "Cursed Dagger",
            atk: 60,
            stats: ["최대 HP-200", "무기 ATK+13", "물리관통+5%", "이상내성-5%"],
            drop: "에토스 성채: 데스 폼베스트"
        },
        {
            category: "필드/보스",
            name: "이형 단도",
            name_en: "Strange Dagger",
            atk: 72,
            stats: ["크리티컬 데미지+3", "크리티컬 데미지+3%", "MDEF-33%"],
            drop: "이계의 문: 누레토스 (입장보스)"
        },
        {
            category: "필드/보스",
            name: "핀 나이프",
            name_en: "Fin Knife",
            atk: 47,
            stats: ["크리티컬 데미지+5", "Avoid 회복+10%", "안정률-10%", "불내성-20%"],
            drop: "전생의 샘: 프라펜"
        },
        {
            category: "필드/보스",
            name: "여신의 단검",
            name_en: "Goddess Dagger",
            atk: 1,
            stats: ["INT+5", "최대 MP+100", "공격 MP 회복+1", "물리내성-10%"],
            drop: "어둠의 성 / 그랜드 홀: 이미터 그리스 (입장보스)"
        },
        {
            category: "필드/보스",
            name: "어스름의 단도",
            name_en: "Twilight Dagger",
            atk: 10,
            stats: ["공격속도+10%", "시전속도+10%", "물리추격 10%", "마법추격 10%"],
            drop: "솔피니 산악요새 / 옥상: 어스름의 용 (입장보스)"
        },
        {
            category: "필드/보스",
            name: "데미 나이프",
            name_en: "Damage Knife",
            atk: 54,
            stats: ["크리티컬률+5", "최대 MP+150", "부여정지(기죽음)", "Avoid-30%"],
            drop: "자동포대 방위선: 데미마키나"
        },
        {
            category: "필드/보스",
            name: "카오스 나이프",
            name_en: "Chaos Knife",
            atk: 84,
            stats: ["최대 HP+1000", "무내성+10%", "최대 MP-100"],
            drop: "대형 데미마키나 공장 / 최심부: 모스토 마키나 (입장보스)"
        },
        {
            category: "필드/보스",
            name: "미즈네 나이프",
            name_en: "Mizune Knife",
            atk: 71,
            stats: ["Avoid+10%", "공격속도+250", "물리관통+5%"],
            drop: "아르티메아 / 지하수로: 솔져 래트"
        },
        {
            category: "필드/보스",
            name: "황녀의 단검",
            name_en: "Empress Dagger",
            atk: 104,
            stats: ["Avoid+15%", "크리티컬률+10%", "물내성-15%"],
            drop: "아르티메아 궁전 / 황녀 옥좌의 방: 베네나 (입장보스)"
        },
        {
            category: "필드/보스",
            name: "수호의 단검",
            name_en: "Guardian Dagger",
            atk: 80,
            stats: ["최대 HP+10%", "물리내성+10%", "마법내성-10%"],
            drop: "땅을 꿰뚫은 탑: 가돈"
        },
        {
            category: "필드/보스",
            name: "바위 이빨 단검",
            name_en: "Rock Tooth Dagger",
            atk: 179,
            stats: ["(옵션 불명/소켓)"],
            drop: "망실의 동굴: 스톤"
        },
        {
            category: "필드/보스",
            name: "홀리 나이프",
            name_en: "Holy Knife",
            atk: 100,
            stats: ["MATK+2%", "어둠내성+10%", "부여정지(넘어짐)"],
            drop: "신들의 신전 / 구성신의 신전: 프리시마티"
        },
        {
            category: "필드/보스",
            name: "타천사의 단도",
            name_en: "Fallen Angel Dagger",
            atk: 150,
            stats: ["ATK+3%", "크리티컬 데미지+3", "데미지 반사 0.01%"],
            drop: "베르바로스 회랑: 필드보스, 웰버브"
        },
        {
            category: "필드/보스",
            name: "인섹트 나이프",
            name_en: "Insect Knife",
            atk: 110,
            stats: ["명중+30", "공격속도+200", "Avoid 회복+10%"],
            drop: "라비란스 지구: 인섹터"
        },
        {
            category: "필드/보스",
            name: "너클 나이프",
            name_en: "Knuckle Knife",
            atk: 60,
            stats: ["물리관통+5%", "DEF+15", "방어 무너뜨리기 +10%"],
            drop: "아이나니스의 역원: 코르네라 뱀"
        },
        {
            category: "필드/보스",
            name: "회 치는 칼",
            name_en: "Sashimi Knife",
            atk: 130,
            stats: ["물속성 데미지+5%", "물내성+10%", "어그로-15%"],
            drop: "루나헨테 절벽 밑: 파결"
        },
        {
            category: "필드/보스",
            name: "봉인의 부적",
            name_en: "Sealed Talisman",
            atk: 72,
            stats: ["MATK+3%", "시전속도+10%", "빛내성-30%", "(지팡이 장비 시) 빛내성+25%"],
            drop: "아르슈 골짜기 A1: 페시"
        },
        {
            category: "필드/보스",
            name: "황마의 단검",
            name_en: "Empress Soul Dagger",
            atk: 150,
            stats: ["Avoid 회복+15%", "크리티컬률+10", "마법관통+5%"],
            drop: "네오 플라스티다: 레이드보스, 베네나 메타코에누비아"
        },
        {
            category: "필드/보스",
            name: "생명의 가지 단검",
            name_en: "Branch of Life Dagger",
            atk: 150,
            stats: ["최대 HP+20%", "Hp 자연회복+10%", "안정률 5%"],
            drop: "토람 세계: 모베레 스페큘라 - 옴가젤"
        },
        {
            category: "필드/보스",
            name: "비크 나이프",
            name_en: "Beak Knife",
            atk: 157,
            stats: ["STR+1%", "ATK+1%", "발도공격+1%", "안정률-3%"],
            drop: "토람 세계: 불가니 산기슭 - 도도스"
        },
        {
            category: "필드/보스",
            name: "안티크 나이프",
            name_en: "Antique Knife",
            atk: 100,
            stats: ["(옵션 불명)"],
            drop: "더러운 골동품 상자"
        },
        // ==========================================
        // 한정 / 이벤트 (Limited / Event)
        // ==========================================
        {
            category: "한정/이벤트",
            name: "초콜릿 나이프",
            name_en: "Chocolate Knife",
            atk: 60,
            stats: ["자연 HP 회복+15%", "비율 배리어 10%", "Avoid 회복+5%", "부여정지(넘어짐)"],
            drop: "발렌타인데이 / 대장간 제작"
        },
        {
            category: "한정/이벤트",
            name: "우드 쵸코 단검",
            name_en: "Wood Choco Dagger",
            atk: 83,
            stats: ["최대 MP+400", "Avoid 회복+4%", "공격 MP 회복+4"],
            drop: "발렌타인 데이 / 다른 과자 만들기 퀘스트 (감로의 나락: 랄바육)"
        },
        {
            category: "한정/이벤트",
            name: "후르츠 나이프",
            name_en: "쿠킹렘 파밍",
            atk: 212,
            stats: ["최대 MP+200", "MP회복+5", "크리티컬률+10"],
            drop: "발렌타인데이 /230~/ 카르카오 농촌 유적 "
        },
        {
            category: "한정/이벤트",
            name: "꽃봉오리 단검",
            name_en: "Flower Bud Dagger",
            atk: 15,
            stats: ["MATK+1%", "시전속도+300", "이상내성+5%"],
            drop: "화이트 데이 / 과자의 승부는 달지않는다!? 퀘스트 (쿠키 도로플로라트)"
        },
        {
            category: "한정/이벤트",
            name: "비스켓 나이프",
            name_en: "Biscuit Knife",
            atk: 70,
            stats: ["최대 MP+200", "어그로-20%", "MP 자연회복+10%"],
            drop: "화이트데이 / 대장간 제작"
        },
        {
            category: "한정/이벤트",
            name: "마시멜로 나이프",
            name_en: "Marshmallow Knife",
            atk: 45,
            stats: ["최대 MP+100", "명중+10%", "Avoid 회복+10%", "(자동활 장비 시) 안정률+10%"],
            drop: "화이트데이 / 대장간 제작"
        },
        {
            category: "한정/이벤트",
            name: "신비한 단검",
            name_en: "Mysterious Dagger",
            atk: 126,
            stats: ["바람속성 데미지+5%", "바람내성+5%", "공격속도+5%"],
            drop: "화이트데이 / 의뢰와 경쟁과 착각 퀘스트 (설탕의 평원: 코린)"
        },
        {
            category: "한정/이벤트",
            name: "영화의 단검",
            name_en: "Cherry Blossom Dagger",
            atk: 110,
            stats: ["최대 MP+100", "안정률+5%", "Guard 회복+25%", "Guard력+25%"],
            drop: "벚꽃 4장 미에지아 (입장보스)"
        },
        {
            category: "한정/이벤트",
            name: "밤 벚꽃 단검",
            name_en: "Night Cherry Blossom Dagger",
            atk: 130,
            stats: ["공격 MP 회복+6", "공격속도+400"],
            drop: "벚꽃 5장 아말감 (입장보스)"
        },
        {
            category: "한정/이벤트",
            name: "주맹의 단검",
            name_en: "Jue Dagger",
            atk: 170,
            stats: ["크리티컬률+14", "명중+7", "Avoid 회복+10%"],
            drop: "벚꽃 6장 입장보스, 만개한 주맹 부위 파괴 보상"
        },
        {
            category: "한정/이벤트",
            name: "벚꽃의 단검",
            name_en: "Cherry Blossom Dagger (Craft)",
            atk: 200,
            stats: ["최대 MP+250", "물리내성+10%", "마법내성+15%", "어그로-20%"],
            drop: "벚꽃 이벤트 / 대장간 제작"
        },
        {
            category: "한정/이벤트",
            name: "주년제 단검",
            name_en: "Anniversary Dagger",
            atk: 126,
            stats: ["Avoid 회복+14%", "시전속도+300", "부여정지(넘어짐)", "(입장레벨 및 상자마다 옵션 다름)"],
            drop: "애니버서리 N주년 EX회장, 주년 장비 박스 I/II/V"
        },
        {
            category: "한정/이벤트",
            name: "다이버즈 나이프",
            name_en: "Diver's Knife",
            atk: 70,
            stats: ["Avoid 회복+6%", "크리티컬률+12", "바람내성-9%"],
            drop: "여름 이벤트 / 대장간 제작"
        },
        {
            category: "한정/이벤트",
            name: "트릭 단검",
            name_en: "Trick Dagger",
            atk: 121,
            stats: ["마법추격 75%", "시전속도+150"],
            drop: "할로윈 - 입장보스, 쟈스"
        },
        {
            category: "한정/이벤트",
            name: "늑대 손톱 단검",
            name_en: "Wolf Hand Dagger",
            atk: 236,
            stats: ["크리티컬률+15", "크리티컬 데미지-1%"],
            drop: "할로윈 - 필맹의 관, 라기우스"
        },
        {
            category: "한정/이벤트",
            name: "폼류 나이프",
            name_en: "Pomu Knife",
            atk: 60,
            stats: ["크리티컬률+5", "예측 1%", "어둠내성-5%"],
            drop: "겨울 이벤트 / 요울프의 집, 분류곰렙 드랍"
        },
        {
            category: "한정/이벤트",
            name: "얼음 단검",
            name_en: "Ice Dagger",
            atk: 110,
            stats: ["불내성+10%", "부여정지(넘어짐)"],
            drop: "겨울 이벤트 / 톰테의 분관(Lv130-150) 아케트니큐스"
        },
        {
            name: "스테이크 나이프",
            atk: 281,
            stability: "0%",
            stats: ["바람속성", "대미지+5%", "크리티컬률+10", "예측+3%"]
        }
    ]
};