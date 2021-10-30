
import java.net.URL
import java.time._
import java.time.format.DateTimeFormatter
import scala.annotation.tailrec
import scala.collection.mutable.{Map => MutableMap}
import scala.util.Try

class SieveAnalyzer(filter: SieveFilter) {

  private val MAX_SESSION_MS = 30 * 60 * 1000L
  private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
  private val monthFormatter = DateTimeFormatter.ofPattern("yyyy-MM")
  private val timeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

  private val state = State()

  def ingest(request: LoggedRequest): Unit = {
    val date = request.date
    val formattedDate = date.format(dateFormatter)
    val month = request.date.format(monthFormatter)
    val timestamp = LocalDateTime.parse(s"$formattedDate ${request.time}", timeFormatter).
      atZone(ZoneId.of("UTC")).toInstant.toEpochMilli

    if (filter.isBlocked(request)) {
      return
    }

    // Update metrics based on the visitor (if present).
    request.c_ip.foreach(clientIP => {
      state.visitorsByDate.get(date) match {
        case Some(visitorsLog) => {
          val knownTimestamps = visitorsLog.requestsByVisitor.get(clientIP).map(_.timestamps).getOrElse(Nil)

          val timestamps = if (knownTimestamps.contains(timestamp)) {
            knownTimestamps
          } else {
            (timestamp :: knownTimestamps).sorted
          }

          visitorsLog.requestsByVisitor.put(clientIP, RequestLog(timestamps))
        }
        case _ => {
          state.visitorsByDate.put(date, VisitorsLog(
            requestsByVisitor = MutableMap(clientIP -> RequestLog(List(timestamp)))
          ))
        }
      }
    })

    // Update metrics based on the referrer (if present).
    request.cs_referer.foreach(referer => {
      val refererDomain = Try(new URL(referer)).toOption.map(_.getHost).getOrElse(referer)

      state.referersByMonth.get(month) match {
        case Some(refererLog) => {
          val count = refererLog.countByDomain.getOrElse(refererDomain, 0L)
          val updatedCount = count + 1
          refererLog.countByDomain.put(refererDomain, updatedCount)
        }
        case _ => {
          state.referersByMonth.put(month, RefererLog(
            countByDomain = MutableMap(refererDomain -> 1L)
          ))
        }
      }
    })

    // Update metrics based on the page.
    val page = request.cs_uri_stem
    state.pagesByMonth.get(month) match {
      case Some(pageLog) => {
        val count = pageLog.countByPage.getOrElse(page, 0L)
        val updatedCount = count + 1
        pageLog.countByPage.put(page, updatedCount)
      }
      case _ => {
        state.pagesByMonth.put(month, PageLog(
          countByPage = MutableMap(page -> 1L)
        ))
      }
    }
  }

  def compute(): SieveAnalytics = {
    val dailyStats = state.visitorsByDate.toList.map {
      case (day, VisitorsLog(requestsByVisitor)) => {
        val sessions = requestsByVisitor.values.flatMap(log => getSessionDurations(log.timestamps)).toArray

        SieveDailyStats(
          date = day.format(dateFormatter),
          visitors = requestsByVisitor.size,
          avgTimeOnSiteSecs = if (sessions.isEmpty) 0L else (sessions.sum / sessions.length) / 1000L
        )
      }
    }.sortBy(_.date)

    val monthlyStats = state.visitorsByDate.toList.groupBy {
      case (date, _) => date.format(monthFormatter)
    }.toList.map {
      case (month, visitors) => SieveMonthlyStats(
        id = month,
        name = getPrettyMonth(month),
        visitors = visitors.flatMap(_._2.requestsByVisitor.keySet).size,
        referrals = state.referersByMonth.getOrElse(month, RefererLog()).countByDomain.toMap,
        pages = state.pagesByMonth.getOrElse(month, PageLog()).countByPage.toMap
      )
    }.sortBy(_.id)

    SieveAnalytics(
      daily = dailyStats,
      monthly = monthlyStats,
      created = System.currentTimeMillis()
    )
  }

  //
  // Internal
  //

  private def getPrettyMonth(id: String): String = {
    val date = LocalDate.parse(id + "-01", dateFormatter)
    s"${date.getMonth.name.toLowerCase.capitalize} ${date.getYear}"
  }

  @tailrec
  private def getSessionDurations(timestamps: List[Long], durations: List[Long] = Nil): List[Long] = {
    if (timestamps.isEmpty) {
      return durations
    }

    val start = timestamps.min // safe
    val (inSession, afterSession) = timestamps.partition(_ < start + MAX_SESSION_MS)
    val durationMs = inSession.last - start // safe due to inclusion in timestamps

    getSessionDurations(afterSession, durationMs :: durations)
  }

  private case class State(
    visitorsByDate: MutableMap[LocalDate, VisitorsLog] = MutableMap.empty[LocalDate, VisitorsLog],
    referersByMonth: MutableMap[String, RefererLog] = MutableMap.empty[String, RefererLog],
    pagesByMonth: MutableMap[String, PageLog] = MutableMap.empty[String, PageLog]
  )

  private case class RefererLog(
    countByDomain: MutableMap[String, Long] = MutableMap.empty[String, Long]
  )

  private case class PageLog(
    countByPage: MutableMap[String, Long] = MutableMap.empty[String, Long]
  )

  private case class VisitorsLog(
    requestsByVisitor: MutableMap[String, RequestLog]
  )

  private case class RequestLog(
    timestamps: List[Long]
  )
}
