param(
  [string]$BaseUrl = "",
  [switch]$Regression
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RoutePath = Join-Path $Root "app/api/debate/stream/route.ts"
$Route = Get-Content -Raw -Encoding UTF8 $RoutePath

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw "FAIL: $Message"
  }
  Write-Host "PASS: $Message"
}

function From-CodePoints {
  param([int[]]$Codes)
  return -join ($Codes | ForEach-Object { [char]$_ })
}

$Forbidden = @(
  "conditional progress",
  "stop criteria",
  "budget limit",
  "owner",
  "objective evidence",
  "energy budget",
  "success criteria",
  "pilot project"
)

$KoreanDailyQuestion = From-CodePoints @(0xB0B4,0xC77C,32,0xC544,0xCE68,0xC5D0,32,0xBB34,0xC5C7,0xC744,32,0xD558,0xBA74,32,0xC88B,0xC744,0xAE4C,0x3F)
$DinnerQuestion = From-CodePoints @(0xC624,0xB298,32,0xD68C,0xC2DD,0xC740,32,0xC9DC,0xC7A5,0xBA74,0xC774,32,0xC88B,0xB098,0x3F)
$TechQuestion = From-CodePoints @(0x41,0x49,0xB294,32,0xC0AC,0xB78C,0xC744,32,0xC5B4,0xB5BB,0xAC8C,32,0xC0DD,0xAC01,0xD558,0xB098,0x3F)
$AiUsageQuestion = From-CodePoints @(0x41,0x49,0xC640,32,0xC5B4,0xB5BB,0xAC8C,32,0xB9D0,0xD574,0xC57C,32,0xD574,0x3F)
$AiUsageTypoQuestion = From-CodePoints @(0x41,0x49,0xC640,32,0xC5B4,0xB5BB,0xAC8C,32,0xC54C,0xD574,0xC57C,32,0xD574,0x3F)
$AiUsageTypoKeyword = From-CodePoints @(0xC54C,0xD574,0xC57C)
$AiChatLabel = From-CodePoints @(0x41,0x49,32,0xC218,0xB2E4)
$AiWorkQuestion = From-CodePoints @(0x0041,0x0049,0xC5D0,0xAC8C,0x0020,0xC77C,0xC744,0x0020,0xC798,0x0020,0xC2DC,0xD0A4,0xB824,0xBA74,0x003F)
$CompanyAiQuestion = From-CodePoints @(0x0041,0x0049,0xB97C,0x0020,0xD68C,0xC0AC,0xC5D0,0xC11C,0x0020,0xC798,0x0020,0xC0AC,0xC6A9,0xD558,0xB294,0x0020,0xBC29,0xBC95,0xC774,0x0020,0xBB50,0xC9C0,0x003F)
$ReportAiQuestion = From-CodePoints @(0xB300,0xD45C,0xB2D8,0xAED8,0x0020,0xBCF4,0xACE0,0xD560,0x0020,0xB54C,0x0020,0x0041,0x0049,0xB97C,0x0020,0xC5B4,0xB5BB,0xAC8C,0x0020,0xD65C,0xC6A9,0xD558,0xBA74,0x0020,0xC88B,0xC744,0xAE4C,0x003F)
$MealGatheringQuestion = From-CodePoints @(0xC624,0xB298,0x0020,0xD68C,0xC2DD,0xC740,0x0020,0xC911,0xAD6D,0xC9D1,0xC774,0x0020,0xC88B,0xB098,0x003F,0x0020,0xC2E0,0xC138,0xB300,0xC640,0x0020,0xD68C,0xC2DD,0xC740,0x0020,0xC5B4,0xB514,0xAC00,0x0020,0xC88B,0xC9C0,0x003F)
$AiCostHiringQuestion = From-CodePoints @(0x0041,0x0049,0x0020,0xC0AC,0xC6A9,0xC740,0x0020,0xB3C8,0xC774,0x0020,0xB9CE,0xC774,0x0020,0xB4E4,0xC5B4,0x002C,0x0020,0xACBD,0xB825,0xC0AC,0xC6D0,0xACFC,0x0020,0xC2E0,0xC785,0x0020,0xC9C1,0xC6D0,0x0020,0xC911,0x0020,0xB204,0xAD6C,0xB97C,0x0020,0xBF51,0xC744,0xAE4C,0x003F)
$AiUsageHeading = From-CodePoints @(0x41,0x49,0xC5D0,0xAC8C,32,0xC798,32,0xB9D0,0xD558,0xB294,32,0xBC95)
$CompanyAiHeading = From-CodePoints @(0xD68C,0xC0AC,0x0020,0x0041,0x0049,0x0020,0xD65C,0xC6A9,0xBC95)
$ReportAiHeading = From-CodePoints @(0xBCF4,0xACE0,0xC6A9,0x0020,0x0041,0x0049,0x0020,0xD65C,0xC6A9)
$BusinessRecommendation = From-CodePoints @(0xC791,0xC740,0x0020,0xAC80,0xC99D,0x0020,0xD6C4,0x0020,0xCD9C,0xC2DC)
$MealGatheringRecommendation = From-CodePoints @(0xC911,0xAD6D,0xC9D1,0xC740,0x0020,0xC870,0xAC74,0xBD80,0x0020,0xCD94,0xCC9C)
$AiCostHiringRecommendation = From-CodePoints @(0xC5ED,0xD560,0x0020,0xC815,0xC758,0x0020,0xD6C4,0x0020,0xCC44,0xC6A9)
$YoungGenerationWord = From-CodePoints @(0xC2E0,0xC138,0xB300)
$AlcoholWord = From-CodePoints @(0xC220)
$MenuWord = From-CodePoints @(0xBA54,0xB274)
$AiCostWord = From-CodePoints @(0x0041,0x0049,0x0020,0xBE44,0xC6A9)
$ExperiencedWord = From-CodePoints @(0xACBD,0xB825,0xC790)
$JuniorWord = From-CodePoints @(0xC2E0,0xC785)
$ClaudeEmoji = [char]::ConvertFromUtf32(0x2615)
$GptEmoji = [char]::ConvertFromUtf32(0x1F9CA)
$GeminiEmoji = [char]::ConvertFromUtf32(0x1F440)
$MindlessConclusion = From-CodePoints @(0xB9C8,0xC74C,32,0xC5C6,0xC74C)
$ReactionDesign = From-CodePoints @(0xBC18,0xC751,32,0xC124,0xACC4)
$PurposeWord = From-CodePoints @(0xBAA9,0xC801)
$ContextWord = From-CodePoints @(0xB9E5,0xB77D)
$ConstraintWord = From-CodePoints @(0xC81C,0xC57D)
$ExampleWord = From-CodePoints @(0xC608,0xC2DC)
$PharmaQuestion = From-CodePoints @(0xC878,0xB9AC,0xC9C0,32,0xC54A,0xB294,32,0xAC10,0xAE30,0xC57D,32,0xAC1C,0xBC1C,0xC774,32,0xD544,0xC694,0xD55C,0xAC00,0x3F)
$BusinessQuestion = From-CodePoints @(0xC2E0,0xADDC,32,0xC11C,0xBE44,0xC2A4,0xB97C,32,0xBC14,0xB85C,32,0xCD9C,0xC2DC,0xD574,0xB3C4,32,0xB420,0xAE4C,0x3F)
$PeopleQuestion = From-CodePoints @(0xC2E0,0xADDC,32,0xC9C1,0xC6D0,32,0xCC44,0xC6A9,0xC740,32,0xACBD,0xB825,0xC790,0xC640,32,0xC2E0,0xC785,32,0xC911,32,0xB204,0xAD6C,0xB97C,32,0xBF51,0xC744,0xAE4C,0x3F)
$TwoPeople = From-CodePoints @(0xB450,32,0xBD84)

$Forbidden += @(
  (From-CodePoints @(0xC870,0xAC74,0xBD80,32,0xC9C4,0xD589)),
  (From-CodePoints @(0xC911,0xB2E8,32,0xAE30,0xC900)),
  (From-CodePoints @(0xC608,0xC0B0,32,0xD55C,0xB3C4)),
  (From-CodePoints @(0xCC45,0xC784,32,0xC8FC,0xCCB4)),
  (From-CodePoints @(0xAC1D,0xAD00,0xC801,32,0xADFC,0xAC70)),
  (From-CodePoints @(0xC5D0,0xB108,0xC9C0,32,0xC608,0xC0B0)),
  (From-CodePoints @(0xC131,0xACF5,32,0xAE30,0xC900)),
  (From-CodePoints @(0xD30C,0xC77C,0xB7FF,32,0xD504,0xB85C,0xC81D,0xD2B8)),
  (From-CodePoints @(0x314B,0x314B)),
  (From-CodePoints @(0x3160)),
  (From-CodePoints @(0xD5DB,0xC18C,0xB9AC)),
  (From-CodePoints @(0xAC1C,0xC6C3)),
  (From-CodePoints @(0xB808,0xC804,0xB4DC)),
  (From-CodePoints @(0xB514,0xC2DC)),
  (From-CodePoints @(0xC8FC,0xC778,0xB2D8)),
  (From-CodePoints @(0xBC14,0xBCF4)),
  (From-CodePoints @(0xBA4D,0xCCAD)),
  (From-CodePoints @(0xC778,0xD130,0xB137,32,0xBC29,0xC1A1)),
  (From-CodePoints @(0xBC08))
)

Assert-True ($Route.Contains("createSimpleTurnPlans")) "simple mode uses the shared debate engine with a shorter plan"
Assert-True ($Route.Contains("35% useful judgment, 40% friendly character clash, 25% dry inner wit")) "simple mode uses cafe-chat humor/professional tone target"
Assert-True ($Route.Contains("simpleSpeakerStyle")) "simple mode has character style rules"
Assert-True ($Route.Contains("topicThoughtBank")) "inner thoughts use a candidate bank"
Assert-True ($Route.Contains("contextualThoughtBank")) "inner thoughts can react to the previous speaker"
Assert-True ($Route.Contains("pickUnusedThought")) "inner thoughts avoid repetition"
Assert-True ($Route.Contains("shouldUseConnectedFallback")) "simple and deep modes share a connected-reply guard"
Assert-True ($Route.Contains("conversationContext")) "prompts use compressed memory plus immediate previous turn"
Assert-True ($Route.Contains("Immediate previous turn")) "each turn is prompted to react to previous AI"
Assert-True ($Route.Contains("ai_usage")) "AI usage intent exists"
Assert-True ($Route.Contains("ai_chat")) "casual AI chat intent exists"
Assert-True ($Route.Contains("company_ai")) "company AI intent exists"
Assert-True ($Route.Contains("report_ai")) "report AI intent exists"
Assert-True ($Route.Contains("meal_gathering")) "meal gathering intent exists"
Assert-True ($Route.Contains("ai_cost_hiring")) "AI-cost hiring intent exists"
Assert-True ($Route.Contains("buildContextSummary")) "question context summary is extracted"
Assert-True ($Route.Contains($AiChatLabel)) "casual AI questions have a visible label"
Assert-True ($Route.Contains($AiUsageTypoKeyword)) "AI usage classifier handles typo variant"
Assert-True ($Route.Contains("withThoughtEmoji")) "inner thoughts add restrained emoji"
Assert-True ($Route.Contains("shouldUseSimpleFallback")) "report-like simple responses are blocked"
Assert-True ($Route.Contains("looksTooPolishedForCafeChat")) "casual AI chat blocks polished lecture tone"
Assert-True ($Route.Contains("containsUnsafeHumor")) "unsafe meme/community humor is blocked"
Assert-True ($Route.Contains("lacksReactionMarker")) "connected replies require reaction markers"
Assert-True ($Route.Contains("violatesSimpleRhythm")) "simple responses are rhythm-guarded"
Assert-True ($Route.Contains("labelNumber")) "fallback lines vary across rebuttal turns"
Assert-True ($Route.Contains("professionalFallbackFor")) "professional topics use dedicated fallback sets"
Assert-True ($Route.Contains("pickProfessionalFallbackLine")) "professional fallback lines vary by round and speaker"
Assert-True ($Route.Contains("isProfessionalTopic")) "professional topic detection is centralized"
Assert-True ($Route.Contains('"light"')) "light final report template marker exists"
Assert-True ($Route.Contains('"tech"')) "tech final report template marker exists"
Assert-True ($Route.Contains('"fun"')) "fun topic classification marker exists"

if ($BaseUrl.Trim()) {
  $Endpoint = $BaseUrl.TrimEnd("/") + "/api/debate/stream"

  function Invoke-DebateCase {
    param(
      [string]$Question,
      [int]$Rotations = 1,
      [string]$Depth = "simple"
    )

    $Body = @{
      title = $Question
      content = $Question
      discussionDepth = $Depth
      councilMode = "open_debate"
      banterLevel = "spicy"
      rebuttalRotations = $Rotations
    } | ConvertTo-Json -Depth 5

    $Response = Invoke-RestMethod `
      -Uri $Endpoint `
      -Method Post `
      -ContentType "application/json; charset=utf-8" `
      -Body $Body `
      -TimeoutSec 120

    return ($Response | Out-String)
  }

  function Get-SentenceCount {
    param([string]$Message)
    return @(($Message -split '[.!?。！？\r\n]+') | Where-Object { $_.Trim() }).Count
  }

  function Parse-Events {
    param([string]$Text)
    $Events = @()
    foreach ($Line in ($Text -split "`n")) {
      $Trimmed = $Line.Trim()
      if ($Trimmed) {
        $Events += ($Trimmed | ConvertFrom-Json)
      }
    }
    return $Events
  }

  $Text = Invoke-DebateCase -Question $KoreanDailyQuestion -Rotations 3
  Assert-True ($Text.Contains('"topicType":"fun"')) "daily morning question is classified as fun"
  foreach ($Word in $Forbidden) {
    Assert-True (-not $Text.ToLower().Contains($Word.ToLower())) "simple daily answer does not contain forbidden wording"
  }
  Assert-True ($Text.Contains('"template":"light"')) "daily response uses light report template"

  $Events = Parse-Events -Text $Text
  $Thoughts = @($Events | Where-Object { $_.type -eq "thought" } | Select-Object -ExpandProperty message)
  Assert-True ($Thoughts.Count -ge 6) "simple debate emits multiple inner thoughts"
  Assert-True (($Thoughts | Select-Object -Unique).Count -eq $Thoughts.Count) "inner thoughts are not repeated"

  $Turns = @($Events | Where-Object { $_.type -eq "turn" })
  $TurnMessages = @($Turns | Select-Object -ExpandProperty message)
  Assert-True (($TurnMessages | Select-Object -Unique).Count -ge 6) "simple debate avoids repeating fallback lines"

  $DirectReferences = @($Turns | Where-Object {
    $Message = "$($_.message)"
    $Message.Contains("Claude") -or $Message.Contains("GPT") -or $Message.Contains("Gemini") -or $Message.Contains($TwoPeople)
  })
  Assert-True ($DirectReferences.Count -ge 3) "simple debate directly reacts to other AIs"

  foreach ($Turn in $Turns) {
    $Message = "$($Turn.message)"
    if ($Turn.speaker -eq "gpt") {
      Assert-True ($Message.Length -le 125) "GPT simple turn stays short"
      Assert-True ((Get-SentenceCount -Message $Message) -le 1) "GPT simple turn uses one sharp sentence"
    } elseif ($Turn.speaker -eq "claude") {
      Assert-True ($Message.Length -le 185) "Claude simple turn stays concise"
      Assert-True ((Get-SentenceCount -Message $Message) -le 2) "Claude simple turn uses at most two sentences"
    } elseif ($Turn.speaker -eq "gemini") {
      Assert-True ($Message.Length -le 200) "Gemini simple turn stays concise"
      Assert-True ((Get-SentenceCount -Message $Message) -le 2) "Gemini simple turn uses at most two sentences"
    }
  }

  $Chat = Invoke-DebateCase -Question $AiUsageQuestion -Rotations 2
  Assert-True ($Chat.Contains('"topicType":"chat"')) "casual AI talking question is classified as AI chat"
  Assert-True ($Chat.Contains('"topicIntent":"ai_chat"')) "casual AI talking question uses AI chat intent"
  Assert-True ($Chat.Contains('"template":"light"')) "casual AI talking question uses light report template"
  Assert-True (-not $Chat.Contains($AiUsageHeading)) "casual AI talking question avoids heavy usage report heading"
  $ChatEvents = Parse-Events -Text $Chat
  $ChatThoughts = @($ChatEvents | Where-Object { $_.type -eq "thought" } | Select-Object -ExpandProperty message)
  Assert-True (@($ChatThoughts | Where-Object { $_.StartsWith($ClaudeEmoji) -or $_.StartsWith($GptEmoji) -or $_.StartsWith($GeminiEmoji) }).Count -ge 3) "casual AI thoughts include restrained emoji"

  $Usage = Invoke-DebateCase -Question $AiWorkQuestion -Rotations 2
  Assert-True ($Usage.Contains('"topicIntent":"ai_usage"')) "professional AI work question keeps usage intent"
  Assert-True ($Usage.Contains($AiUsageHeading)) "professional AI work final report uses usage-specific template"
  Assert-True (-not $Usage.Contains($MindlessConclusion)) "professional AI work answer avoids AI-feeling conclusion"
  Assert-True (-not $Usage.Contains($ReactionDesign)) "professional AI work answer avoids emotion-design framing"
  Assert-True ($Usage.Contains($PurposeWord) -or $Usage.Contains($ContextWord) -or $Usage.Contains($ConstraintWord) -or $Usage.Contains($ExampleWord)) "professional AI work answer includes practical prompt structure"

  $TypoUsage = Invoke-DebateCase -Question $AiUsageTypoQuestion -Rotations 1
  Assert-True ($TypoUsage.Contains('"topicIntent":"ai_chat"')) "AI talking typo question is classified as chat intent"

  if ($Regression) {
    $Dinner = Invoke-DebateCase -Question $DinnerQuestion -Rotations 1
    Assert-True ($Dinner.Contains('"topicType":"fun"')) "dinner menu question stays light"
    Assert-True ($Dinner.Contains('"template":"light"')) "dinner menu uses light report template"
    Assert-True (-not $Dinner.Contains("https://")) "dinner menu does not force evidence links"

    $Tech = Invoke-DebateCase -Question $TechQuestion -Rotations 1
    Assert-True ($Tech.Contains('"topicType":"chat"')) "casual AI concept question is classified as chat"
    Assert-True ($Tech.Contains('"topicIntent":"ai_chat"')) "casual AI concept question keeps chat intent"
    Assert-True ($Tech.Contains('"template":"light"')) "casual AI concept uses light report template"

    $Pharma = Invoke-DebateCase -Question $PharmaQuestion -Rotations 3
    Assert-True ($Pharma.Contains('"topicType":"pharma"')) "cold medicine question is classified as pharma"
    Assert-True (($Pharma.ToLower().Contains("fda.gov") -or $Pharma.Contains("mfds.go.kr"))) "pharma keeps official evidence links"
    $PharmaEvents = Parse-Events -Text $Pharma
    $PharmaTurns = @($PharmaEvents | Where-Object { $_.type -eq "turn" })
    foreach ($SpeakerName in @("claude", "gpt", "gemini")) {
      $Messages = @($PharmaTurns | Where-Object { $_.speaker -eq $SpeakerName } | Select-Object -ExpandProperty message)
      Assert-True (($Messages | Select-Object -Unique).Count -eq $Messages.Count) "pharma fallback does not repeat $SpeakerName lines"
    }

    $Business = Invoke-DebateCase -Question $BusinessQuestion -Rotations 1
    Assert-True ($Business.Contains('"topicType":"business"')) "service launch question is classified as business"
    Assert-True ($Business.Contains('"template":"report"')) "business question keeps report template"
    Assert-True ($Business.Contains($BusinessRecommendation)) "business final report is business-specific"

    $People = Invoke-DebateCase -Question $PeopleQuestion -Rotations 1
    Assert-True ($People.Contains('"topicType":"people"')) "hiring question is classified as people"
    Assert-True ($People.Contains('"template":"report"')) "people question keeps report template"

    $CompanyAi = Invoke-DebateCase -Question $CompanyAiQuestion -Rotations 1
    Assert-True ($CompanyAi.Contains('"topicIntent":"company_ai"')) "company AI question uses company AI intent"
    Assert-True ($CompanyAi.Contains($CompanyAiHeading)) "company AI final report is company-specific"
    Assert-True (-not $CompanyAi.Contains($AiUsageHeading)) "company AI question avoids prompt-only final report"

    $ReportAi = Invoke-DebateCase -Question $ReportAiQuestion -Rotations 1
    Assert-True ($ReportAi.Contains('"topicIntent":"report_ai"')) "boss report AI question uses report AI intent"
    Assert-True ($ReportAi.Contains($ReportAiHeading)) "report AI final report is report-specific"
    Assert-True (-not $ReportAi.Contains($AiUsageHeading)) "report AI question avoids prompt-only final report"

    $MealGathering = Invoke-DebateCase -Question $MealGatheringQuestion -Rotations 1
    Assert-True ($MealGathering.Contains('"topicIntent":"meal_gathering"')) "meal gathering question uses meal context intent"
    Assert-True ($MealGathering.Contains($MealGatheringRecommendation)) "meal gathering final report reflects Chinese restaurant context"
    Assert-True ($MealGathering.Contains($YoungGenerationWord) -or $MealGathering.Contains($AlcoholWord) -or $MealGathering.Contains($MenuWord)) "meal gathering debate keeps real context"

    $AiCostHiring = Invoke-DebateCase -Question $AiCostHiringQuestion -Rotations 1
    Assert-True ($AiCostHiring.Contains('"topicIntent":"ai_cost_hiring"')) "AI-cost hiring question keeps mixed context"
    Assert-True ($AiCostHiring.Contains($AiCostHiringRecommendation)) "AI-cost hiring final report is mixed-context specific"
    Assert-True ($AiCostHiring.Contains($AiCostWord) -or $AiCostHiring.Contains($ExperiencedWord) -or $AiCostHiring.Contains($JuniorWord)) "AI-cost hiring debate keeps AI cost and hiring context"

    $DeepBusiness = Invoke-DebateCase -Question $BusinessQuestion -Rotations 1 -Depth "deep"
    Assert-True ($DeepBusiness.Contains('"topicType":"business"')) "deep business debate still runs"
    Assert-True ($DeepBusiness.Contains('"template":"report"')) "deep business debate keeps report template"
  }
}

Write-Host "All simple/deep verification checks passed."
