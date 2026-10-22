"""Builds the 2-page parent/coach quick-start guide (Alliance-Tracker-Guide.pdf)."""
import sys
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Frame, KeepTogether, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[1])
OUT = Path(sys.argv[2])
URL = "https://scalisec.github.io/alliance-tracker/"
URL_SHORT = "scalisec.github.io/alliance-tracker"

F = "/usr/share/fonts/truetype/crosextra/"
pdfmetrics.registerFont(TTFont("Body", F + "Carlito-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Bold", F + "Carlito-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Italic", F + "Carlito-Italic.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Bold", italic="Italic", boldItalic="Bold")

NAVY = HexColor("#043B83")
NAVY_DK = HexColor("#022A5E")
RED = HexColor("#D7263D")
INK = HexColor("#1A1D21")
MUTED = HexColor("#5F6672")
LINE = HexColor("#E3E5EA")
SOFT = HexColor("#F2F5FA")
BLUE_SOFT = HexColor("#E8EFFA")

W, H = letter
M = 42  # margin

body = ParagraphStyle("body", fontName="Body", fontSize=10.5, leading=14, textColor=INK)
small = ParagraphStyle("small", parent=body, fontSize=9.5, leading=12.5, textColor=MUTED)
step = ParagraphStyle("step", parent=body, leftIndent=16, firstLineIndent=-16, spaceAfter=4)
q_style = ParagraphStyle("q", parent=body, fontName="Bold", fontSize=10.5, leading=13.5, spaceAfter=2, textColor=NAVY_DK)
a_style = ParagraphStyle("a", parent=body, fontSize=10, leading=13.2, spaceAfter=9)


def section_title(c, x, y, num, text):
    c.setFillColor(NAVY)
    c.circle(x + 10, y + 4, 10, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Bold", 12)
    c.drawCentredString(x + 10, y + 0.3, str(num))
    c.setFillColor(INK)
    c.setFont("Bold", 16)
    c.drawString(x + 28, y - 1, text)


def card(c, x, y, w, h, fill=SOFT, stroke=LINE, r=10):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, r, stroke=1, fill=1)


def paras(c, items, x, y_top, w, h):
    f = Frame(x, y_top - h, w, h, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, showBoundary=0)
    f.addFromList(list(items), c)


def share_icon(c, x, y, s=9):
    """iOS Share glyph: box with an up arrow."""
    c.saveState()
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.1)
    c.line(x + s / 2, y + 2, x + s / 2, y + s + 2)
    c.line(x + s / 2, y + s + 2, x + s / 2 - 2.6, y + s - 0.6)
    c.line(x + s / 2, y + s + 2, x + s / 2 + 2.6, y + s - 0.6)
    c.roundRect(x, y - 1.5, s, s * 0.8, 1.5, stroke=1, fill=0)
    c.restoreState()


def footer(c, page):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(M, 34, W - M, 34)
    c.setFont("Body", 8.5)
    c.setFillColor(MUTED)
    c.drawString(M, 23, "Alliance Tracker is an unofficial community app, not affiliated with or endorsed by the Minor Hockey Alliance of Ontario.")
    c.drawString(M, 12, "Questions or feedback: benchbosslabs@gmail.com")
    c.drawRightString(W - M, 23, f"{page} / 2")


def page1(c):
    # ---- header band
    band_h = 128
    c.setFillColor(NAVY)
    c.rect(0, H - band_h, W, band_h, stroke=0, fill=1)
    c.setFillColor(NAVY_DK)
    c.rect(0, H - band_h, W, 5, stroke=0, fill=1)
    c.setFillColor(RED)
    c.rect(0, H - band_h - 4, W, 4, stroke=0, fill=1)

    # logo on a white tile
    logo = ROOT / "public" / "assets" / "alliance-logo.png"
    c.setFillColor(white)
    c.roundRect(M, H - band_h + 24, 80, 80, 14, stroke=0, fill=1)
    c.drawImage(ImageReader(str(logo)), M + 8, H - band_h + 32, 64, 64, mask="auto", preserveAspectRatio=True, anchor="c")

    c.setFillColor(white)
    c.setFont("Bold", 28)
    c.drawString(M + 98, H - 62, "Alliance Tracker")
    c.setFont("Body", 13.5)
    c.drawString(M + 98, H - 82, "Quick-start guide for parents and coaches")
    c.setFont("Body", 10.5)
    c.setFillColor(HexColor("#C9D7EE"))
    c.drawString(M + 98, H - 100, "Standings, scores and schedules for ALLIANCE Hockey rep teams.")

    # QR code
    qr_size = 92
    qx, qy = W - M - qr_size - 6, H - band_h + 18
    c.setFillColor(white)
    c.roundRect(qx - 6, qy - 6 + 4, qr_size + 12, qr_size + 12, 8, stroke=0, fill=1)
    w = QrCodeWidget(URL)
    b = w.getBounds()
    d = Drawing(qr_size, qr_size, transform=[qr_size / (b[2] - b[0]), 0, 0, qr_size / (b[3] - b[1]), 0, 0])
    d.add(w)
    renderPDF.draw(d, c, qx, qy + 4)

    # ---- link strip
    y = H - band_h - 4 - 40
    card(c, M, y, W - 2 * M, 30, fill=BLUE_SOFT, stroke=BLUE_SOFT, r=8)
    c.setFillColor(NAVY_DK)
    c.setFont("Bold", 12)
    c.drawString(M + 12, y + 10, "Scan the code or open:")
    c.setFillColor(NAVY)
    c.drawString(M + 136, y + 10, URL_SHORT)
    c.linkURL(URL, (M + 136, y + 6, M + 340, y + 22), relative=0)
    c.setFillColor(MUTED)
    c.setFont("Body", 10.5)
    c.drawRightString(W - M - 12, y + 10, "Free  ·  No account  ·  Android and iPhone")

    # ---- 1. Install
    y -= 36
    section_title(c, M, y, 1, "Install it on your phone (about 30 seconds)")
    paras(c, [Paragraph("Installing adds an Alliance icon to your home screen and opens the app full-screen. "
                        "It isn't in an app store, so there's nothing to download or sign up for.", small)],
          M + 28, y - 10, W - 2 * M - 28, 30)

    col_w = (W - 2 * M - 14) / 2
    ch = 186
    cy = y - 42 - ch
    for i, (title, sub, steps) in enumerate([
        ("Android", "Chrome or Samsung Internet", [
            "<b>1.</b> Open the link (or scan the code) in <b>Chrome</b> or <b>Samsung Internet</b>.",
            "<b>2.</b> Tap the gear <b>Settings</b> icon (top right), then <b>Install</b>.",
            "<b>3.</b> Confirm with <b>Install</b>. The Alliance icon appears on your home screen.",
            "<font color='#5F6672'>No Install button? Open the browser menu (the three dots or three lines) and choose <b>Add to Home screen</b> / <b>Install app</b>.</font>",
        ]),
        ("iPhone / iPad", "Use Safari", [
            "<b>1.</b> Open the link (or scan the code) in <b>Safari</b>.",
            "<b>2.</b> Tap the <b>Share</b> button at the bottom of the screen (square with an arrow pointing up).",
            "<b>3.</b> Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.",
            "<font color='#5F6672'>Apple only allows this from the Share menu, so there's no one-tap install on iPhone. The steps are also in the app under Settings.</font>",
        ]),
    ]):
        x = M + i * (col_w + 14)
        card(c, x, cy, col_w, ch)
        c.setFillColor(INK)
        c.setFont("Bold", 13.5)
        c.drawString(x + 14, cy + ch - 22, title)
        c.setFont("Body", 10)
        c.setFillColor(MUTED)
        c.drawString(x + 14 + c.stringWidth(title, "Bold", 13.5) + 8, cy + ch - 22, sub)
        if i == 1:
            share_icon(c, x + col_w - 26, cy + ch - 25)
        note = ParagraphStyle("note", parent=small, spaceBefore=4)
        paras(c, [Paragraph(s, note if s.startswith("<font") else step) for s in steps], x + 14, cy + ch - 34, col_w - 28, ch - 40)

    # ---- 2. Follow your team
    y = cy - 40
    section_title(c, M, y, 2, "Follow your team")
    steps = [
        "<b>1.</b> On <b>My Teams</b>, tap <b>+ Team</b> (top left).",
        "<b>2.</b> Search by city, association, team name or division, e.g. <b>Burlington</b>, <b>Bulldogs</b> or <b>U10 BB</b>. "
        "Each result shows the division, current place and points, so you can pick the right team.",
        "<b>3.</b> Tap <b>+ Add</b>. It turns into <b>Saved</b> and a confirmation pops up (with <b>Undo</b> if you tapped the wrong one).",
        "<b>4.</b> Add as many teams as you like (siblings, rivals, the team you coach), then tap <b>Done</b> (top right).",
    ]
    box_h = 112
    card(c, M, y - 16 - box_h, W - 2 * M, box_h, fill=white)
    paras(c, [Paragraph(s, step) for s in steps], M + 14, y - 26, W - 2 * M - 28, box_h - 14)

    # ---- tip strip
    ty = y - 16 - box_h - 46
    card(c, M, ty, W - 2 * M, 36, fill=HexColor("#FFF4F5"), stroke=HexColor("#F6D3D8"), r=8)
    c.setFillColor(RED)
    c.setFont("Bold", 10.5)
    c.drawString(M + 12, ty + 22, "Good to know")
    c.setFillColor(INK)
    c.setFont("Body", 10)
    c.drawString(M + 12, ty + 9, "Your saved teams are stored on your own phone; nobody else sees them. Add the same teams on each device you use.")

    footer(c, 1)


def page2(c):
    y = H - 50
    section_title(c, M, y, 3, "Key features")

    shots = [
        ("myteams", "My Teams", "Record, division place, last 5 results with streak, and your next games."),
        ("standings", "Standings", "Pick age and level; your teams are highlighted. Tap any team to see its games."),
        ("schedule", "Schedule", "Games by day with rink and LiveBarn link. Games in progress are marked LIVE."),
        ("game", "Game details", "Refresh score and GameSheet's live scoring; the full box score after the game."),
    ]
    gap = 12
    sw = (W - 2 * M - 3 * gap) / 4
    sh = sw * 760 / 390
    top = y - 18
    cap = ParagraphStyle("cap", parent=small, fontSize=9, leading=11.5)
    for i, (f, title, text) in enumerate(shots):
        x = M + i * (sw + gap)
        # phone-like frame
        c.setFillColor(HexColor("#0A0A0A"))
        c.roundRect(x - 3, top - sh - 3, sw + 6, sh + 6, 12, stroke=0, fill=1)
        c.drawImage(ImageReader(str(SHOTS / f"{f}.png")), x, top - sh, sw, sh)
        c.setFillColor(INK)
        c.setFont("Bold", 11.5)
        c.drawString(x, top - sh - 18, title)
        paras(c, [Paragraph(text, cap)], x, top - sh - 23, sw, 48)

    # ---- team page tip
    ty = top - sh - 92
    card(c, M, ty, W - 2 * M, 34, fill=BLUE_SOFT, stroke=BLUE_SOFT, r=8)
    paras(c, [Paragraph("<b>Team pages:</b> tap any team in Standings, or your team's name on My Teams, to open its page: "
                        "record, last 5 games and streak, every result (tap one for the game details) and the upcoming schedule.", small)],
          M + 12, ty + 28, W - 2 * M - 24, 30)

    # ---- FAQ
    fy = ty - 26
    section_title(c, M, fy, 4, "Frequently asked questions")
    faq = [
        ("How up to date are scores and standings?",
         "On weekends it updates about every 20 minutes from 7 AM to midnight, on weekday evenings from 5 PM, plus every night. "
         "Final scores appear once the game sheet is submitted to Alliance, usually shortly after the game."),
        ("Can I follow a game while it's being played?",
         "Yes. Tap a game marked <b>LIVE</b> and open <b>Live on GameSheet</b> for live scoring (when the scorekeeper uses the GameSheet app). "
         "<b>Refresh score</b> picks up the final as soon as it's posted."),
        ("Where are the goal scorers and penalties?",
         "Tap a finished game and open <b>Box score from GameSheet</b>: scorers, assists and penalties, right in the app."),
        ("Can I watch games?",
         "Games at LiveBarn rinks show a red <b>LiveBarn</b> button for live or replay. LiveBarn needs its own subscription."),
        ("Which divisions are included?",
         "All ALLIANCE rep divisions: U10 to U18 AAA, AA-A and BB, plus U8 and U9 MD. MD games don't keep score, so MD shows schedules only."),
        ("What is the MHR number on my team?",
         "Its MYHockey Rankings rating. It fills in as teams play enough games; until then it shows a dash."),
        ("Does it cost anything or need a sign-in?",
         "No. It's free, there's no account, and it doesn't collect any personal information."),
        ("Something looks out of date or wrong.",
         "Tap <b>Refresh score</b> on the game, or <b>Settings</b> (gear icon) → <b>Refresh now</b>, or close and reopen the app. "
         "Standings follow alliancehockey.com, which is always the official source."),
        ("How do I remove a team or change dark/light mode?",
         "Tap <b>+ Team</b>, find the team and tap <b>Saved</b> to remove it. Theme, install and the app version are in <b>Settings</b>."),
    ]
    # Lay Q&A pairs into two columns, never splitting a pair.
    col_w = (W - 2 * M - 22) / 2
    top_y, bottom_y = fy - 24, 46
    col, cy = 0, top_y
    for q, a in faq:
        pq, pa = Paragraph(q, q_style), Paragraph(a, a_style)
        hq = pq.wrap(col_w, 1000)[1]
        ha = pa.wrap(col_w, 1000)[1]
        need = hq + 2 + ha + 9
        if cy - need < bottom_y:
            col += 1
            cy = top_y
            if col > 1:
                raise SystemExit('FAQ does not fit on page 2')
        x = M + col * (col_w + 22)
        pq.drawOn(c, x, cy - hq)
        pa.drawOn(c, x, cy - hq - 2 - ha)
        cy -= need
    footer(c, 2)


def main():
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Alliance Tracker – Quick-start guide")
    c.setAuthor("Alliance Tracker")
    c.setSubject("How to install and use Alliance Tracker")
    page1(c)
    c.showPage()
    page2(c)
    c.showPage()
    c.save()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
