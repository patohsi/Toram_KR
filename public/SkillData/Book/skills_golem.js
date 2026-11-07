// skills_golem.js
// 골렘 스킬: 이름/구조는 Toram Plaza·코린 클럽 기준. 설명은 직접 입력 예정이다.

const golemTree = {
    id: "golem",
    name: "골렘 스킬",
    url_param: "Golem",
    description: "골렘을 소환하고 강화하는 스킬입니다.",
    skills: [
        {
            id: "golem_call",
            name: "골렘 소환",
            name_en: "Golem Call",
            tier: 1,
            type: "Active",
            mp_cost: 500,
            description: ``
        },
        {
            id: "neo_lancer",
            name: "랜서형 개량",
            name_en: "Neo Lancer",
            tier: 2,
            type: "Passive",
            prereq: "golem_call",
            description: ``
        },
        {
            id: "attack_boost",
            name: "어택 강화",
            name_en: "Attack Boost",
            tier: 3,
            type: "Passive",
            prereq: "neo_lancer",
            description: ``
        },
        {
            id: "neo_shielder",
            name: "실드형 개량",
            name_en: "Neo Shielder",
            tier: 2,
            type: "Passive",
            prereq: "golem_call",
            description: ``
        },
        {
            id: "shield_boost",
            name: "실드 강화",
            name_en: "Shield Boost",
            tier: 3,
            type: "Passive",
            prereq: "neo_shielder",
            description: ``
        },
        {
            id: "neo_buster",
            name: "버스터형 개량",
            name_en: "Neo Buster",
            tier: 2,
            type: "Passive",
            prereq: "golem_call",
            description: ``
        },
        {
            id: "speed_boost",
            name: "스피드 강화",
            name_en: "Speed Boost",
            tier: 3,
            type: "Passive",
            prereq: "neo_buster",
            description: ``
        },
        {
            id: "magic_grenade",
            name: "마도 그레네이드",
            name_en: "Magic Grenade",
            tier: 1,
            type: "Active",
            mp_cost: 100,
            description: ``
        },
        {
            id: "frost_grenade",
            name: "동결 그레네이드",
            name_en: "Frost Grenade",
            tier: 2,
            type: "Active",
            mp_cost: 200,
            prereq: "magic_grenade",
            description: ``
        },
        {
            id: "flash_grenade",
            name: "섬광 그레네이드",
            name_en: "Flash Grenade",
            tier: 3,
            type: "Active",
            mp_cost: 300,
            prereq: "frost_grenade",
            description: ``
        },
        {
            id: "barrier_screen",
            name: "배리어 스크린",
            name_en: "Barrier Screen",
            tier: 2,
            type: "Active",
            mp_cost: 300,
            prereq: "magic_grenade",
            description: ``
        },
        {
            id: "barrier_upgrade",
            name: "배리어 강화",
            name_en: "Barrier Upgrade",
            tier: 3,
            type: "Passive",
            prereq: "barrier_screen",
            description: ``
        },
    ]
};
