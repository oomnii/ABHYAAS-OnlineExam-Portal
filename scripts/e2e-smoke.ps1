# Full E2E smoke for ABHYAAS — run against a live local server
param(
  [string]$Base = 'http://localhost:3000',
  [int]$Pass = 1
)

$ErrorActionPreference = 'Stop'
function Assert($cond, $msg) {
  if (-not $cond) { throw "PASS $Pass FAIL: $msg" }
}
function WriteJson($path, $obj) {
  ($obj | ConvertTo-Json -Compress -Depth 6) | Set-Content -Path $path -Encoding ascii -NoNewline
}

$tmp = Join-Path $env:TEMP "abhyaas-e2e-$Pass"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$tc = Join-Path $tmp 'teacher.txt'
$sc = Join-Path $tmp 'student.txt'
$suffix = Get-Random

# 1) Health + static pages
$h = curl.exe -s "$Base/api/health" | ConvertFrom-Json
Assert ($h.status -eq 'ok') 'health'
foreach ($p in @(
  '/', '/index.html', '/role-select.html', '/login.html', '/signup.html',
  '/student.html', '/teacher.html', '/quiz.html', '/result.html', '/export.html',
  '/css/styles.css', '/js/api.js', '/js/constants.js', '/js/academic.js', '/assets/logo.png'
)) {
  # academic.js is server-only — skip; constants is public
}
foreach ($p in @(
  '/', '/index.html', '/role-select.html', '/login.html', '/signup.html',
  '/css/styles.css', '/js/api.js', '/js/constants.js', '/assets/logo.png'
)) {
  $code = curl.exe -s -o NUL -w '%{http_code}' "$Base$p"
  Assert ($code -eq '200') "static $p ($code)"
}

# 2) Auth me anonymous
$me0 = curl.exe -s "$Base/api/auth/me" | ConvertFrom-Json
Assert ($null -eq $me0.user) 'me anonymous'

# 3) Teacher login
WriteJson (Join-Path $tmp 'tlogin.json') @{ email = 'teacher@abhyaas.local'; password = 'Teacher@123' }
$tLogin = curl.exe -s -c $tc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'tlogin.json')" "$Base/api/auth/login" | ConvertFrom-Json
Assert ($tLogin.user.role -eq 'teacher') 'teacher login'
Assert ($null -eq $tLogin.user.branch) 'teacher no branch'

$meT = curl.exe -s -b $tc "$Base/api/auth/me" | ConvertFrom-Json
Assert ($meT.user.email -eq 'teacher@abhyaas.local') 'teacher me'

# 4) Student login + academic fields
WriteJson (Join-Path $tmp 'slogin.json') @{ email = 'student@abhyaas.local'; password = 'Student@123' }
$sLogin = curl.exe -s -c $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'slogin.json')" "$Base/api/auth/login" | ConvertFrom-Json
Assert ($sLogin.user.role -eq 'student') 'student login'
Assert ($sLogin.user.branch -eq 'CSE' -and $sLogin.user.semester -eq '5' -and $sLogin.user.registrationNo -eq 'DEMO2025001') 'student profile'

# 5) Wrong password
WriteJson (Join-Path $tmp 'badlogin.json') @{ email = 'teacher@abhyaas.local'; password = 'WrongPass' }
$badCode = curl.exe -s -o (Join-Path $tmp 'badlogin.out') -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'badlogin.json')" "$Base/api/auth/login"
Assert ($badCode -eq '400') 'bad login 400'

# 6) Student signup validation + success
WriteJson (Join-Path $tmp 'signup-bad.json') @{ name = 'Bad'; email = "bad$suffix@test.com"; password = 'abcdef'; role = 'student' }
$signupBad = curl.exe -s -o NUL -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'signup-bad.json')" "$Base/api/auth/signup"
Assert ($signupBad -eq '400') 'signup missing academic 400'

$sc2 = Join-Path $tmp 'student2.txt'
WriteJson (Join-Path $tmp 'signup-ok.json') @{
  name = "Student $suffix"; email = "stu$suffix@test.com"; password = 'abcdef'; role = 'student'
  branch = 'IT'; semester = '3'; registrationNo = "REG$suffix"
}
$signupOk = curl.exe -s -c $sc2 -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'signup-ok.json')" "$Base/api/auth/signup" | ConvertFrom-Json
Assert ($signupOk.user.branch -eq 'IT' -and $signupOk.user.semester -eq '3') 'signup IT/3'

# 7) Teacher dashboard + create quiz with targeting
$td = curl.exe -s -b $tc "$Base/api/teacher/dashboard" | ConvertFrom-Json
Assert ($td.stats.totalQuizzes -ge 1) 'teacher dashboard'

WriteJson (Join-Path $tmp 'quiz-cse.json') @{
  title = "E2E CSE $suffix"; subject = 'E2E'; timerMinutes = 5; status = 'published'
  targetBranch = 'CSE'; targetSemester = '5'; instructions = 'E2E quiz'
}
$quizCse = curl.exe -s -b $tc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'quiz-cse.json')" "$Base/api/quizzes" | ConvertFrom-Json
Assert ($quizCse.quiz.id -gt 0) 'create CSE quiz'
$quizCseId = $quizCse.quiz.id

WriteJson (Join-Path $tmp 'quiz-it.json') @{
  title = "E2E IT $suffix"; subject = 'E2E'; timerMinutes = 5; status = 'published'
  targetBranch = 'IT'; targetSemester = '3'; instructions = 'IT only'
}
$quizIt = curl.exe -s -b $tc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'quiz-it.json')" "$Base/api/quizzes" | ConvertFrom-Json
$quizItId = $quizIt.quiz.id

# 8) Add questions of multiple types
function Add-Q($quizId, $body) {
  $p = Join-Path $tmp ("q-$([guid]::NewGuid()).json")
  WriteJson $p $body
  curl.exe -s -b $tc -H 'Content-Type: application/json' --data-binary "@$p" "$Base/api/quizzes/$quizId/questions" | ConvertFrom-Json
}

$q1 = Add-Q $quizCseId @{ questionType = 'mcq'; questionText = '2+2?'; optionA = '3'; optionB = '4'; optionC = '5'; optionD = '6'; correctOption = 'B'; marks = 1; explanation = 'math' }
$q2 = Add-Q $quizCseId @{ questionType = 'true_false'; questionText = 'Sky is blue'; correctOption = 'True'; marks = 1 }
$q3 = Add-Q $quizCseId @{ questionType = 'fill_blank'; questionText = 'Capital of France is _____'; correctOption = 'Paris'; marks = 1 }
$q4 = Add-Q $quizCseId @{ questionType = 'one_word'; questionText = 'HTTP success code word?'; correctOption = 'ok'; marks = 1 }
$q5 = Add-Q $quizCseId @{ questionType = 'numerical'; questionText = '10/2'; correctOption = '5'; marks = 1 }
Assert ($q1.question.id -and $q5.question.id) 'added 5 question types'

Add-Q $quizItId @{ questionType = 'mcq'; questionText = 'IT Q'; optionA = 'A'; optionB = 'B'; optionC = ''; optionD = ''; correctOption = 'A'; marks = 1 } | Out-Null

# 9) Targeting: CSE student sees CSE quiz, not IT; IT student opposite
$sqDemo = curl.exe -s -b $sc "$Base/api/quizzes/student" | ConvertFrom-Json
$demoTitles = @($sqDemo.quizzes | ForEach-Object { $_.title })
Assert ($demoTitles -contains "E2E CSE $suffix") 'demo student sees CSE targeted'
Assert (-not ($demoTitles -contains "E2E IT $suffix")) 'demo student hides IT targeted'

$sqIt = curl.exe -s -b $sc2 "$Base/api/quizzes/student" | ConvertFrom-Json
$itTitles = @($sqIt.quizzes | ForEach-Object { $_.title })
Assert ($itTitles -contains "E2E IT $suffix") 'IT student sees IT quiz'
Assert (-not ($itTitles -contains "E2E CSE $suffix")) 'IT student hides CSE quiz'

# 10) Forbidden: student cannot create quiz
$forbid = curl.exe -s -o NUL -w '%{http_code}' -b $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'quiz-cse.json')" "$Base/api/quizzes"
Assert ($forbid -eq '403') 'student create quiz forbidden'

# 11) Full attempt flow: start → answer → warning → submit → result
WriteJson (Join-Path $tmp 'start.json') @{ quizId = $quizCseId; studentName = 'Demo Student'; rollNumber = 'R100' }
$bundle = curl.exe -s -b $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'start.json')" "$Base/api/attempts/start" | ConvertFrom-Json
Assert ($bundle.attempt.id -gt 0) 'start attempt'
Assert ($bundle.questions.Count -eq 5) 'attempt has 5 questions'
$attemptId = $bundle.attempt.id

foreach ($item in $bundle.questions) {
  $ans = $null
  if ($item.questionType -eq 'mcq' -or $item.questionType -eq 'true_false') {
    # pick first option key that exists
    $ans = @($item.options.PSObject.Properties.Name)[0]
    # Prefer correct-looking: for true_false try A (True mapped)
    if ($item.questionType -eq 'true_false') { $ans = 'A' }
  } elseif ($item.questionType -eq 'numerical') {
    $ans = '5'
  } elseif ($item.questionType -eq 'fill_blank') {
    $ans = 'Paris'
  } else {
    $ans = 'ok'
  }
  # For MCQ find key whose text is 4
  if ($item.questionType -eq 'mcq') {
    foreach ($prop in $item.options.PSObject.Properties) {
      if ($prop.Value -eq '4') { $ans = $prop.Name; break }
    }
  }
  WriteJson (Join-Path $tmp 'ans.json') @{ itemId = $item.id; selectedKey = $ans }
  $saved = curl.exe -s -b $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'ans.json')" "$Base/api/attempts/$attemptId/answer" | ConvertFrom-Json
  Assert ($saved.ok -eq $true) "save answer item $($item.id)"
}

$warn = curl.exe -s -b $sc -X POST "$Base/api/attempts/$attemptId/warning" | ConvertFrom-Json
Assert ($warn.warningCount -ge 1) 'warning recorded'

WriteJson (Join-Path $tmp 'submit.json') @{ remainingTime = 100 }
$submitted = curl.exe -s -b $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'submit.json')" "$Base/api/attempts/$attemptId/submit" | ConvertFrom-Json
Assert ($submitted.result.attempt.status -eq $null -or $submitted.result.attempt.score -ge 0) 'submit result'
Assert ($null -ne $submitted.result.attempt.percentage) 'has percentage'
Assert ($submitted.result.attempt.warningCount -ge 1) 'warnings on result'

$result = curl.exe -s -b $sc "$Base/api/results/$attemptId" | ConvertFrom-Json
Assert ($result.result.review.Count -eq 5) 'result review 5'
Assert ($null -ne $result.result.leaderboard) 'leaderboard embedded'

# Teacher can view result + analytics
$tResult = curl.exe -s -b $tc "$Base/api/results/$attemptId" | ConvertFrom-Json
Assert ($tResult.result.attempt.id -eq $attemptId) 'teacher views result'
$analytics = curl.exe -s -b $tc "$Base/api/teacher/quizzes/$quizCseId/analytics" | ConvertFrom-Json
Assert ($analytics.summary.attemptCount -ge 1) 'analytics attempts'

# 12) Single attempt enforcement
$againCode = curl.exe -s -o NUL -w '%{http_code}' -b $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'start.json')" "$Base/api/attempts/start"
Assert ($againCode -eq '400') 'second attempt blocked'

# 13) Notes CRUD
WriteJson (Join-Path $tmp 'note.json') @{ content = "Note $suffix" }
$note = curl.exe -s -b $sc -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'note.json')" "$Base/api/student/notes" | ConvertFrom-Json
Assert ($note.note.id -gt 0) 'create note'
$noteId = $note.note.id
WriteJson (Join-Path $tmp 'note2.json') @{ content = "Updated $suffix" }
$noteU = curl.exe -s -b $sc -X PUT -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'note2.json')" "$Base/api/student/notes/$noteId" | ConvertFrom-Json
Assert ($noteU.note.content -eq "Updated $suffix") 'update note'
$noteDel = curl.exe -s -b $sc -X DELETE "$Base/api/student/notes/$noteId" | ConvertFrom-Json
Assert ($noteDel.ok -eq $true) 'delete note'

# 14) Update quiz + delete IT quiz cleanup
WriteJson (Join-Path $tmp 'quiz-upd.json') @{ title = "E2E CSE UPD $suffix"; status = 'published' }
$upd = curl.exe -s -b $tc -X PUT -H 'Content-Type: application/json' --data-binary "@$(Join-Path $tmp 'quiz-upd.json')" "$Base/api/quizzes/$quizCseId" | ConvertFrom-Json
Assert ($upd.quiz.title -eq "E2E CSE UPD $suffix") 'update quiz'
$del = curl.exe -s -b $tc -X DELETE "$Base/api/quizzes/$quizItId" | ConvertFrom-Json
Assert ($del.ok -eq $true) 'delete IT quiz'

# 15) Logout
$out = curl.exe -s -b $tc -c $tc -X POST "$Base/api/auth/logout" | ConvertFrom-Json
Assert ($out.ok -eq $true) 'logout'
$meAfter = curl.exe -s -b $tc "$Base/api/auth/me" | ConvertFrom-Json
Assert ($null -eq $meAfter.user) 'me after logout'

Write-Host "PASS $Pass ALL E2E CHECKS OK"
