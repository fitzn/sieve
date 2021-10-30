
import java.time.LocalDate

case class LoggedRequest(
  date: LocalDate,
  time: String,
  x_edge_location: Option[String],
  sc_bytes: Option[Long],
  c_ip: Option[String],
  cs_method: String,
  cs_host: String,
  cs_uri_stem: String,
  sc_status: Int,
  cs_referer: Option[String],
  cs_user_agent: Option[String],
  cs_uri_query: Option[String],
  cs_cookie: Option[String],
  x_edge_result_type: Option[String],
  x_edge_request_id: Option[String],
  x_host_header: Option[String],
  cs_protocol: Option[String],
  cs_bytes: Option[Long],
  time_taken: Option[Double],
  x_forwarded_for: Option[String],
  ssl_protocol: Option[String],
  ssl_cipher: Option[String],
  x_edge_response_result_type: Option[String],
  cs_protocol_version: Option[String],
  fle_status: Option[String],
  fle_encrypted_fields: Option[String],
  c_port: Option[Int],
  time_to_first_byte: Option[Double],
  x_edge_detailed_result_type: Option[String],
  sc_content_type: Option[String],
  sc_content_len: Option[Long],
  sc_range_start: Option[String],
  sc_range_end: Option[String]
)

case class LogSlice(
  filename: String,
  requests: Array[LoggedRequest],
  numSkipped: Int
)

case class SieveAnalytics(
  daily: List[SieveDailyStats],
  monthly: List[SieveMonthlyStats],
  created: Long // epoch ms
) {
  def toJson: String = {
    val dailyJson = daily.map(_.toJson).mkString("[", ", ", "]")
    val monthlyJson = monthly.map(_.toJson).mkString("[", ", ", "]")

    s"""
      |{
      |  "daily": $dailyJson,
      |  "monthly": $monthlyJson,
      |  "created": $created
      |}
      |""".stripMargin
  }
}

case class SieveDailyStats(
  date: String,
  visitors: Long,
  avgTimeOnSiteSecs: Long
) {
  def toJson: String = {
    s"""
      |{
      |  "date": "$date",
      |  "visitors": $visitors,
      |  "avgTimeOnSiteSecs": $avgTimeOnSiteSecs
      |}
      |""".stripMargin.trim
  }
}

case class SieveMonthlyStats(
  id: String, // yyyy-MM
  name: String, // January 2022
  visitors: Long,
  referrals: Map[String, Long],
  pages: Map[String, Long]
) {
  def toJson: String = {
    val referralsStr = referrals.toList.map {
      case (domain, count) =>
        s"""
           |"$domain": $count
           |""".stripMargin.trim
    }.mkString("{", ", ", "}")

    val pagesStr = pages.toList.map {
      case (path, count) =>
        s"""
           |"$path": $count
           |""".stripMargin.trim
    }.mkString("{", ", ", "}")

    s"""
      |{
      |  "id": "$id",
      |  "name": "$name",
      |  "visitors": $visitors,
      |  "referrals": $referralsStr,
      |  "pages": $pagesStr
      |}
      |""".stripMargin
  }
}
